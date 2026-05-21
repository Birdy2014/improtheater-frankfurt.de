import pug from "pug";
import { Marked } from "marked";
import { SqliteError } from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Request, Response } from "express";
import db, { Subscriber } from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import * as workshops from "./workshops.js";
import type { ExtendedWorkshop } from "./workshops.js";
import { getCurrentTimestamp } from "../common/time";
import { EMailOptions, EMailTransporter } from "./mail.js";
import { common_marked_options } from "../common/marked_options";

const transporter = {
    itf: new EMailTransporter("itf"),
    improglycerin: new EMailTransporter("improglycerin"),
};

interface QueueItemNewsletter {
    item_type: "newsletter",
    recipients: SubscriberLike[],
    recipientsAmount: number,
    workshops: ExtendedWorkshop[],
}

interface QueueItemPendingNewsletter {
    item_type: "pending_newsletter",
    workshopIds: number[],
    sendTime: number,
}

interface QueueItemConfirm {
    item_type: "confirm",
    recipients: SubscriberLike[],
}

type QueueItem = QueueItemNewsletter | QueueItemPendingNewsletter | QueueItemConfirm;

const mail_queue: QueueItem[] = [];

const cf_turnstile_secret = utils.config.cf_turnstile_secret || fs.readFileSync(utils.config.cf_turnstile_secret_file!, "utf8").replace(/\n/g, "");

const marked_black_links = new Marked(common_marked_options("text-decoration: underline; color: #000000;"));
const marked_white_links = new Marked(common_marked_options("text-decoration: underline; color: #ffffff;"));

export async function subscribe(req: Request, res: Response) {
    const body = req.body as { name?: string; email?: string; token?: string; subscribedTo?: number; cf_turnstile_response?: string };
    try {
        if (body.subscribedTo)
            body.subscribedTo &= 3;

        if (!validNewsletterType(body.subscribedTo)) {
            throw new utils.HTTPError(400);
        }

        // User is already subscribed
        if (body.token) {
            const subscriber = getSubscriber(body.token);
            if (subscriber && body.subscribedTo == subscriber.subscribedTo)
                return res.sendStatus(200);
            db.run("UPDATE subscriber SET subscribedTo = ? WHERE token = ?", body.subscribedTo, body.token);
            return res.sendStatus(200);
        }

        // User is not subscribed
        if (!body.cf_turnstile_response || !body.name || !body.email) {
            throw new utils.HTTPError(400);
        }
        if (body.name.length > 200) {
            throw new utils.HTTPError(400, "Name too long");
        }
        if (body.email.length > 254) {
            throw new utils.HTTPError(400, "Email too long");
        }
        const form_data = new FormData();
        form_data.append("secret", cf_turnstile_secret);
        form_data.append("response", body.cf_turnstile_response);
        try {
            const cf_turnstile_response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
                method: "POST",
                body: form_data,
            });
            const cf_turnstile_result = await cf_turnstile_response.json();
            if (!cf_turnstile_result.success) {
                throw new utils.HTTPError(400, "Invalid Cloudflare turnstile token")
            }
        } catch (error) {
            throw new utils.HTTPError(400, "Invalid Cloudflare turnstile token")
        }

        removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = getCurrentTimestamp();
        const subscriber: Subscriber = {
            name: body.name,
            email: body.email,
            token,
            timestamp,
            subscribedTo: body.subscribedTo,
            confirmed: 0,
            last_viewed_newsletter: 0
        };
        db.run("INSERT INTO subscriber (name, email, token, timestamp, subscribedTo, confirmed, last_viewed_newsletter) VALUES (?, ?, ?, ?, ?, ?, ?)", subscriber.name, subscriber.email, subscriber.token, subscriber.timestamp, subscriber.subscribedTo, subscriber.confirmed, subscriber.last_viewed_newsletter);
        queue_confirm_email(subscriber)
        res.sendStatus(200);
    } catch(e) {
        if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
            throw new utils.HTTPError(409);
        }
        throw e;
    }
}

export function confirm(req: Request, res: Response) {
    if (!req.body.token) {
        res.sendStatus(400);
        return;
    }
    db.run("UPDATE subscriber SET confirmed = 1 WHERE token = ?", req.body.token);
    res.sendStatus(200);
}

export function unsubscribe(req: Request, res: Response) {
    if (!req.body.token) {
        throw new utils.HTTPError(400);
    }

    let subscriber = getSubscriber(req.body.token);
    if (!subscriber) {
        throw new utils.HTTPError(404);
    }

    const unsubscribeFrom = req.body.type || 0xFF

    const newSubscribedTo = subscriber.subscribedTo & ~unsubscribeFrom;
    if (newSubscribedTo)
        db.run("UPDATE subscriber SET subscribedTo = ? WHERE token = ?", newSubscribedTo, req.body.token);
    else
        db.run("DELETE FROM subscriber WHERE token = ?", req.body.token);
    res.sendStatus(200);
}

export function api_get_status(req: Request, res: Response) {
    if (!req.user) {
        throw new utils.HTTPError(401);
    }

    const mail_status = mail_queue
        .filter((batch): batch is QueueItemNewsletter | QueueItemPendingNewsletter => batch.item_type === "newsletter" || batch.item_type === "pending_newsletter")
        .map(batch => { if (batch.item_type === "newsletter") {
            return {
                itemType: batch.item_type,
                recipientsLeft: batch.recipients.length,
                recipientsAmount: batch.recipientsAmount,
                workshops: batch.workshops.map(w => ({ id: w!.id, title: w!.title })),
            };
        } else {
            return {
                itemType: batch.item_type,
                workshops: batch.workshopIds.map(id => {
                    const w = workshops.getWorkshop(id, true);
                    return { id: w!.id, title: w!.title }
                }),
                sendTime: batch.sendTime,
            };
        }
    });

    res.json(mail_status);
}

function arraysEqual(a: any[], b: any[]) {
    if (a.length !== b.length) {
        return false;
    }

    return !a.some((element, index) => element !== b[index]);
}

export function api_post_cancel(req: Request, res: Response) {
    if (!req.user) {
        throw new utils.HTTPError(401);
    }

    if (!req.body.workshops) {
        throw new utils.HTTPError(400);
    }

    const index = mail_queue.findIndex(mail_batch => {
        switch (mail_batch.item_type) {
        case "newsletter": {
            const workshop_ids = mail_batch.workshops.filter(w => w !== undefined).map(w => w!.id);
            return arraysEqual(workshop_ids, req.body.workshops);
        }
        case "pending_newsletter": {
            return arraysEqual(mail_batch.workshopIds, req.body.workshops);
        }
        default:
            return false;
        }
    });

    if (index < 0) {
        throw new utils.HTTPError(404);
    }

    mail_queue.splice(index, 1);
    res.status(200);
}

export async function send_from_queue() {
    const mail_batch_index = mail_queue.findIndex(mail_batch => mail_batch.item_type === "newsletter" || mail_batch.item_type === "confirm");

    if (mail_batch_index < 0) {
        const pending_queue_item_index = mail_queue.findIndex(mail_batch => mail_batch.item_type === "pending_newsletter" && mail_batch.sendTime < getCurrentTimestamp());

        if (pending_queue_item_index >= 0) {
            const pending_queue_item = mail_queue[pending_queue_item_index] as QueueItemPendingNewsletter;
            mail_queue.splice(pending_queue_item_index, 1);
            queue_newsletter(pending_queue_item.workshopIds);
        }

        setTimeout(send_from_queue, 4_000);
        return;
    }

    const mail_batch = mail_queue[mail_batch_index] as QueueItemNewsletter | QueueItemConfirm;

    const recipient = mail_batch.recipients.shift()
    if (!recipient) {
        mail_queue.splice(mail_batch_index, 1);
        if (mail_queue.length === 0) {
            logger.info("Mail queue is now empty")
        }
        setTimeout(send_from_queue, 4_000);
        return;
    }

    const mail = mail_batch.item_type === "newsletter"
        ? build_newsletter(mail_batch.workshops as ExtendedWorkshop[], recipient)
        : build_confirm_mail(recipient);

    let log_message = `[${mail_queue.length} batches, ${mail_batch.recipients.length}/${mail_batch.item_type === "newsletter" ? mail_batch.recipientsAmount: 1} rcpt] `;

    if (mail_batch.item_type === "newsletter") {
        const workshop_ids = mail_batch.workshops.filter((w): w is ExtendedWorkshop => w !== undefined).map(workshop => workshop.id);
        log_message += `newsletter ${workshop_ids.join(", ")} to ${recipient.email}`;
    } else {
        log_message += `confirm to ${recipient.email}`;
    }

    try {
        const smtp_response = await sendMail(mail.type, {
            to: mail.email,
            replyTo: "hallo@improglycerin.de",
            subject: mail.subject,
            html: mail.html,
            text: mail.text
        });

        logger.info(`${log_message} - '${smtp_response}'`)
    } catch (error) {
        const err = error as Error & { responseCode?: number; response?: string };
        logger.error(`${log_message} - ${err.message}`)
        if (err.responseCode === 450 && err.response?.includes("Transmit rate limit exceeded")) {
            mail_batch.recipients.push(recipient);
            logger.info("Rate limit exceeded - requeued recipient");
            setTimeout(send_from_queue, 20 * 60 * 1000);
            return;
        }
    }

    setTimeout(send_from_queue, 4_000);
}

const mail_queue_save_path = path.join(utils.config.data_directory, "mail_queue.json");
export function store_mail_queue_to_file() {
    if (mail_queue.length === 0) {
        return;
    }
    fs.writeFileSync(mail_queue_save_path, JSON.stringify(mail_queue));
    mail_queue.length = 0;
}

export function load_mail_queue_from_file() {
    try {
        const serialized_queue = fs.readFileSync(mail_queue_save_path);
        fs.unlinkSync(mail_queue_save_path);
        if (process.env.NODE_ENV !== "development" || !process.env.ITF_SEND_MAILS) {
            mail_queue.push(...JSON.parse(serialized_queue.toString()) as QueueItem[]);
        }
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
            throw e;
        }
    }
}

function queue_newsletter(workshop_ids: number[], test_subscriber?: SubscriberLike) {
    const workshops_to_send = workshop_ids.map(id => workshops.getWorkshop(id, true));

    if (workshops_to_send.some(w => !w)) {
        throw new utils.HTTPError(404);
    }

    if (!test_subscriber) {
        workshop_ids.forEach(id => workshops.editWorkshop({ id, visible: 1, newsletterSent: 1 }));
    }

    const validWorkshops = workshops_to_send as ExtendedWorkshop[];
    const workshop_type = validWorkshops.reduce((type, workshop) => type | workshop.type, 0);
    const target_subscribers = test_subscriber
        ? [test_subscriber]
        : getSubscribers().filter(({subscribedTo}) => subscribedTo & workshop_type);

    mail_queue.push({
        recipients: target_subscribers,
        recipientsAmount: target_subscribers.length,
        item_type: "newsletter",
        workshops: workshops_to_send as ExtendedWorkshop[],
    });
}

function queue_pending_newsletter(workshopIds: number[], sendTime: number) {
    if (workshopIds.map(id => workshops.getWorkshop(id, true)).some(w => !w)) {
        throw new utils.HTTPError(404);
    }

    mail_queue.push({
        item_type: "pending_newsletter",
        workshopIds,
        sendTime,
    });
}

type SubscriberLike = Pick<Subscriber, "name" | "email" | "token" | "subscribedTo">;

function queue_confirm_email(subscriber: SubscriberLike) {
    mail_queue.unshift({
        recipients: [subscriber],
        item_type: "confirm",
    });
}

function build_newsletter(workshops_to_send: ExtendedWorkshop[], subscriber: SubscriberLike) {
    const workshop_type = workshops_to_send.reduce((type, workshop) => type | workshop.type, 0);

    if (typeof workshop_type !== "number") {
        throw new utils.HTTPError(500, "Invalid workshop type.");
    }

    const logo = workshop_type === workshops.WorkshopType.Itf
        ? utils.config.base_url + "/public/img/improtheater_frankfurt_logo.png"
        : utils.config.base_url + "/public/img/improglycerin_logo.jpg";

    const unsubscribe = utils.config.base_url + "/newsletter?unsubscribe=1&token=" + subscriber.token;
    const workshops_for_subscriber = workshops_to_send.map(workshop => ({
        ...workshop,
        website: `${utils.config.base_url}/workshop/${workshop.id}?token=${subscriber.token}`,
        img_url: `${utils.config.base_url}/api/upload/${workshop.id}?token=${subscriber.token}`,
    }));

    const subject = workshops_for_subscriber.length === 1
        ? (workshops_for_subscriber[0].propertiesHidden ? workshops_for_subscriber[0].title : workshops_for_subscriber[0].title + ", am " + workshops_for_subscriber[0].dateText)
        : workshops_for_subscriber.map(workshop => workshop.title).join(" / ");

    const weblink = workshops_to_send.length === 1
        ? `${utils.config.base_url}/workshop/${workshops_to_send[0].id}`
        : `${utils.config.base_url}/workshops`;

    const preview_link = `${utils.config.base_url}/newsletter-preview?token=${subscriber.token}&${workshops_to_send.map(w => `workshops=${w.id}`).join("&")}`;

    let html = pug.renderFile(utils.project_path + "/client/views/emails/newsletter.pug", {
        subject: subject,
        workshops: workshops_for_subscriber,
        weblink,
        preview_link,
        unsubscribe,
        logo,
        subscriber,
        marked_black_links,
        marked_white_links,
        base_url: utils.config.base_url
    });

    const text =
        workshops_for_subscriber.map(workshop =>
            `Im Browser anschauen: ${preview_link}\n\n`
            + `${workshop.title} - ${weblink}\n\n`
            + (workshop.propertiesHidden
                ? ""
                : `${workshop.dateText ?? ""}, ${workshop.timeText}, ${workshop.email}\n`
                + `${workshop.location}\n\n`)
            + `${workshop.content}\n\n`
        ).join("\n\n")
        + `\n\nImpressum: https://improtheater-frankfurt.de/impressum\nDatenschutz: https://improglycerin.de/datenschutz\nKontakt: https://improglycerin.de/kontakt/\nAbmelden: ${unsubscribe}`;

    return {
        email: subscriber.email,
        type: workshop_type,
        subject,
        text,
        html,
    };
}

function build_confirm_mail(subscriber: SubscriberLike) {
    const link = utils.config.base_url + "/newsletter?token=" + subscriber.token;
    const subscribe = utils.config.base_url + "/newsletter?subscribe=1&token=" + subscriber.token;
    const html = pug.renderFile(utils.project_path + "/client/views/emails/confirm.pug", {
        name: subscriber.name,
        link,
        subscribedTo: subscriber.subscribedTo,
        subscribe,
    });

    return {
        email: subscriber.email,
        type: subscriber.subscribedTo,
        subject: "Improtheater Frankfurt Newsletterbestätigung",
        text: `Liebe/r ${subscriber.name},\nvielen Dank für die Bestellung unseres Newsletters, in dem Du zukünftig über unsere Workshops, unsere Jams und unsere Shows informiert wirst.\nBitte bestätige durch Klick auf diesen Link, dass Du unseren tollen Newsletter erhalten möchtest: ${link}`,
        html,
    };
}

function arraysOverlap(a: any[], b: any[]): boolean {
    return a.some(elementA => b.some(elementB => elementA === elementB));
}

export async function send(req: Request, res: Response) {
    if (!req.user || !req.body.workshops || !Array.isArray(req.body.workshops)) {
        throw new utils.HTTPError(400);
    }

    const sendTime = Number.isInteger(req.body.sendTime) ? req.body.sendTime : 0;

    const workshop_ids_to_send = req.body.workshops.map((id: string | number) => parseInt(String(id)));

    if (sendTime > getCurrentTimestamp()) {
        if (req.body.test) {
            throw new utils.HTTPError(400, "Can't queue test mail");
        }
        queue_pending_newsletter(workshop_ids_to_send, sendTime);
        res.sendStatus(200);
        return;
    }

    if (!req.body.test && mail_queue.some(mail_batch => {
        switch (mail_batch.item_type) {
        case "newsletter": {
            const workshop_ids = mail_batch.workshops.filter(w => w !== undefined).map(w => w!.id);
            return arraysOverlap(workshop_ids, workshop_ids_to_send);
        }
        case "pending_newsletter":
            return arraysOverlap(mail_batch.workshopIds, workshop_ids_to_send);
        default:
            return false;
        }
    })) {
        throw new utils.HTTPError(400, "Mindestens ein Workshop dieses Newsletters wird bereits gesendet");
    }

    let test_subscriber: SubscriberLike | undefined = undefined;
    if (req.body.test) {
        test_subscriber = {
            name: req.user.username,
            email: req.user.email,
            token: "",
            subscribedTo: 3
        };
    }

    queue_newsletter(workshop_ids_to_send, test_subscriber);
    res.sendStatus(200);
}

export async function preview(req: Request, res: Response) {
    if (!req.query.workshops) {
        throw new utils.HTTPError(400);
    }

    const workshop_ids_to_send = Array.isArray(req.query.workshops)
        ? req.query.workshops.map(id => parseInt(String(id)))
        : [parseInt(String(req.query.workshops))];

    const workshops_to_send = workshop_ids_to_send.map(id => workshops.getWorkshop(id, true));
    if (!req.user && workshops_to_send.some(w => w && w.newsletterSent)) {
        throw new utils.HTTPError(403);
    }

    const token = req.query.token as string | undefined;
    let subscriber: SubscriberLike = getSubscriber(token || "") ?? { name: "", email: "", token: "", subscribedTo: 0 };
    if (!subscriber || Object.keys(subscriber).length === 0) {
        subscriber = {
            name: req.user?.username || "",
            email: req.user?.email || "",
            token: "",
            subscribedTo: 3
        };
    }

    const validWorkshops = workshops_to_send.filter((w): w is ExtendedWorkshop => w !== undefined);
    const newsletter = build_newsletter(validWorkshops, subscriber);

    res.send(newsletter.html);
}

export function exportSubscribers(req: Request, res: Response) {
    if (!req.user) {
        throw new utils.HTTPError(403);
    }

    let subscribers = getSubscribers();
    let csv = "email,name,firstname,lastname,subscribedate\r\n";
    for (let subscriber of subscribers) {
        let nameparts = subscriber.name.split(" ");
        let lastname = nameparts.pop();
        let firstname = nameparts.join(" ");
        let time = new Date(subscriber.timestamp).toISOString();
        time = time.substring(0, time.lastIndexOf(":"));
        csv += `${subscriber.email},${subscriber.name},${firstname},${lastname},${time}\r\n`;
    }
    res.status(200).send(csv);
}

export function addSubscriber(req: Request, res: Response) {
    if (!req.user) {
        throw new utils.HTTPError(403);
    }

    if (!req.body.name || !req.body.email || !req.body.subscribedTo || !validNewsletterType(req.body.subscribedTo)) {
        throw new utils.HTTPError(400);
    }

    try {
        removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = getCurrentTimestamp();
        db.run("INSERT INTO subscriber (name, email, token, timestamp, confirmed, subscribedTo) VALUES (?, ?, ?, ?, 1, ?)", req.body.name, req.body.email, token, timestamp, req.body.subscribedTo);
        res.sendStatus(200);
    } catch(e) {
        if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
            throw new utils.HTTPError(409);
        }
        throw e;
    }
}

export function getSubscribers() {
    return db.all<Subscriber>("SELECT * FROM subscriber WHERE confirmed = 1");
}

export function getSubscriber(token: string) {
    return db.get<Subscriber>("SELECT * FROM subscriber WHERE token = ?", token);
}

function removeExpiredSubscribers() {
    const week = 7 * 24 * 60 * 60;
    const expired = getCurrentTimestamp() - week;
    db.run("DELETE FROM subscriber WHERE confirmed = 0 AND timestamp < ?", expired);
}

function validNewsletterType(subscribedTo?: number) {
    return subscribedTo == 1 || subscribedTo == 2 || subscribedTo == 3;
}

async function sendMail(type: workshops.WorkshopType, options: EMailOptions) {
    const namedType = type == workshops.WorkshopType.Itf ? "itf" : "improglycerin";
    return await transporter[namedType].send(options);
}
