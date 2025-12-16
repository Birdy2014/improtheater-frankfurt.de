import pug from "pug";
import { Marked } from "marked";
import { SqliteError } from "better-sqlite3";
import path from "path";
import fs from "fs";
import db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import * as workshops from "./workshops.js";
import { EMailTransporter } from "./mail.js";

const transporter = {
    itf: new EMailTransporter("itf"),
    improglycerin: new EMailTransporter("improglycerin"),
};

/**
 *  @type {{ recipients: Object[], is_newsletter: boolean, workshops: Object[]|null }[]}
 */
const mail_queue = [];


function get_marked_options(style) {
    return {
        breaks: true,
        renderer: {
            link({ href, title, tokens }) {
                const text = this.parser.parseInline(tokens);
                try {
                    href = encodeURI(href).replace(/%25/g, "%");
                } catch {
                    return text;
                }
                let out = `<a href="${href}"`;
                if (title) {
                  out += ` title="${title}"`;
                }
                out += ` style="${style}">${text}</a>`;
                return out;
            }
        }
    }
}

const marked_black_links = new Marked(get_marked_options("text-decoration: underline; color: #000000;"));
const marked_white_links = new Marked(get_marked_options("text-decoration: underline; color: #ffffff;"));

export function subscribe(req, res) {
    // TODO: check email address, length limit name, sanitize name and email
    try {
        if (req.body.subscribedTo)
            req.body.subscribedTo &= 3;

        if (((!req.body.name || !req.body.email) && !req.body.token) || !req.body.subscribedTo || !validNewsletterType(req.body.subscribedTo)) {
            throw new utils.HTTPError(400);
        }

        // User is already subscribed
        if (req.body.token) {
            const subscriber = getSubscriber(req.body.token);
            if (req.body.subscribedTo == subscriber.subscribedTo)
                return res.sendStatus(200);
            db.run("UPDATE subscriber SET subscribedTo = ? WHERE token = ?", req.body.subscribedTo, req.body.token);
            return res.sendStatus(200);
        }

        // User is not subscribed
        removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = utils.getCurrentTimestamp();
        const subscriber = {
            name: req.body.name,
            email: req.body.email,
            token,
            timestamp,
            subscribedTo: req.body.subscribedTo,
        };
        db.run("INSERT INTO subscriber (name, email, token, timestamp, subscribedTo) VALUES (?, ?, ?, ?, ?)", subscriber.name, subscriber.email, subscriber.token, subscriber.timestamp, subscriber.subscribedTo);
        queue_confirm_email(subscriber)
        res.sendStatus(200);
    } catch(e) {
        if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
            throw new utils.HTTPError(409);
        }
        throw e;
    }
}

export function confirm(req, res) {
    if (!req.body.token) {
        res.sendStatus(400);
        return;
    }
    db.run("UPDATE subscriber SET confirmed = 1 WHERE token = ?", req.body.token);
    res.sendStatus(200);
}

export function unsubscribe(req, res) {
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

export async function send_from_queue() {
    const mail_batch = mail_queue[0]

    if (!mail_batch) {
        return;
    }

    const recipient = mail_batch.recipients.shift()
    if (mail_batch.recipients.length === 0) {
        mail_queue.shift();
    }

    if (mail_batch.is_newsletter) {
        const newsletter = build_newsletter(mail_batch.workshops, recipient);
        const workshop_ids = mail_batch.workshops.map(workshop => workshop.id);
        try {
            const smtp_response = await sendMail(newsletter.type, {
                to: newsletter.email,
                replyTo: "hallo@improglycerin.de",
                subject: newsletter.subject,
                html: newsletter.html,
                text: newsletter.text
            });
            logger.info(`Sent newsletter ${workshop_ids.join(", ")} to ${newsletter.email}. Got response '${smtp_response}'`);
        } catch (e) {
            logger.error(`Failed to send Newsletter ${workshop_ids.join(", ")} to ${newsletter.email}:\n ${e.stack}`);
        }
    } else {
        const mail = build_confirm_mail(recipient);
        try {
            const smtp_response = await sendMail(mail.type, {
                to: mail.email,
                replyTo: "hallo@improglycerin.de",
                subject: mail.subject,
                html: mail.html,
                text: mail.text
            });
            logger.info(`Sent confirm email to ${mail.email}. Got response '${smtp_response}'`);
        } catch (e) {
            logger.error(`Failed to send confirm email to ${mail.email}:\n ${e.stack}`);
        }
    }

    if (mail_queue.length === 0) {
        logger.info("Mail queue is now empty")
    }
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
            mail_queue.push(...JSON.parse(serialized_queue));
        }
    } catch (e) {
        if (e.code !== "ENOENT") {
            throw e;
        }
    }
}

/**
 * @param {number[]} workshop_ids
 * @param {{email: string, name: string, subscribedTo: number, token: string}[]} subscribers
 * @param {boolean} allow_resend
 */
function queue_newsletter(workshop_ids, subscribers, allow_resend) {
    const workshops_to_send = workshop_ids.map(id => workshops.getWorkshop(id, true));
    const workshop_type = workshops_to_send[0].type;

    if (typeof workshop_type !== "number") {
        throw new utils.HTTPError(500, "Invalid workshop type.");
    }

    for (const workshop_to_send of workshops_to_send) {
        if (!workshop_to_send) {
            throw new utils.HTTPError(404);
        }

        if (workshop_to_send.type !== workshop_type) {
            throw new utils.HTTPError(400, "Mismatching workshop types.");
        }

        if (workshop_to_send.newsletterSent && !allow_resend) {
            throw new utils.HTTPError(409, "At least one workshop is already sent.");
        }
    }

    const target_subscribers = subscribers.filter(({subscribedTo}) => subscribedTo & workshop_type);

    mail_queue.push({
        recipients: target_subscribers,
        is_newsletter: true,
        workshops: workshops_to_send,
    });
}

function queue_confirm_email(subscriber) {
    mail_queue.unshift({
        recipients: [subscriber],
        is_newsletter: false,
        workshops: null,
    });
}

/**
 * Instanciates the templates for the given workshops to be sent to the given subscribers
 * @param {Object[]} workshops_to_send
 * @param {{email: string, name: string, subscribedTo: number, token: string}} subscriber
 * @returns {{email: string, type: number, subject: string, text: string, html: string}}
 * @throws {utils.HTTPError}
 */
function build_newsletter(workshops_to_send, subscriber) {
    const workshop_type = workshops_to_send[0].type;

    if (typeof workshop_type !== "number") {
        throw new utils.HTTPError(500, "Invalid workshop type.");
    }

    const logo = workshop_type === workshops.type_itf
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
        : `${workshops_for_subscriber.length} ${workshop_type === workshops.type_itf ? "Workshops" : "Shows"}: ${workshops_for_subscriber.map(workshop => workshop.title).join(" / ")}`;

    const weblink = workshops_to_send.length === 1
        ? `${utils.config.base_url}/workshop/${workshops_to_send[0].id}`
        : `${utils.config.base_url}/workshops`;

    let html = pug.renderFile(utils.project_path + "/client/views/emails/newsletter.pug", {
        subject: subject,
        workshops: workshops_for_subscriber,
        weblink,
        unsubscribe,
        logo,
        subscriber,
        marked_black_links,
        marked_white_links,
        base_url: utils.config.base_url
    });

    const text =
        workshops_for_subscriber.map(workshop =>
            workshop.propertiesHidden
            ? `${workshop.title}\n\n${workshop.content}`
            : `Im Browser anschauen: ${weblink}\n\nImproglycerin lädt ein zu ${workshop.title} am ${workshop.dateText}.\n\n${workshop.content}\n\nWann? ${workshop.timeText}\nWo? ${workshop.location}\nBetrag? ${workshop.price}\nAnmelden? ${workshop.email}`
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

function build_confirm_mail(subscriber) {
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

export async function send(req, res) {
    if (!req.user || !req.body.workshops || !Array.isArray(req.body.workshops)) {
        throw new utils.HTTPError(400);
    }

    const workshop_ids_to_send = req.body.workshops.map(id => parseInt(id));

    let subscribers = [];
    if (req.body.test) {
        subscribers[0] = {
            name: req.user.username,
            email: req.user.email,
            token: "",
            subscribedTo: 3
        };
    } else {
        for (const id of workshop_ids_to_send) {
            db.run("UPDATE workshop SET newsletterSent = 1 WHERE id = ?", id);
        }
        subscribers = getSubscribers();
    }

    // TODO: Really allow resend?
    queue_newsletter(workshop_ids_to_send, subscribers, true);
    res.sendStatus(200);
}

export async function preview(req, res) {
    if (!req.user) {
        throw new utils.HTTPError(403);
    }

    if (!req.query.workshops) {
        throw new utils.HTTPError(400);
    }

    const workshop_ids_to_send = Array.isArray(req.query.workshops)
        ? req.query.workshops.map(id => parseInt(id))
        : [parseInt(req.query.workshops)];

    const subscriber = {
        name: req.user.username,
        email: req.user.email,
        token: "",
        subscribedTo: 3
    };

    const workshops_to_send = workshop_ids_to_send.map(id => workshops.getWorkshop(id, true));
    const newsletter = build_newsletter(workshops_to_send, subscriber, true);

    res.send(newsletter.html);
}

export function exportSubscribers(req, res) {
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

export function addSubscriber(req, res) {
    if (!req.user) {
        throw new utils.HTTPError(403);
    }

    if (!req.body.name || !req.body.email || !req.body.subscribedTo || !validNewsletterType(req.body.subscribedTo)) {
        throw new utils.HTTPError(400);
    }

    try {
        removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = utils.getCurrentTimestamp();
        db.run("INSERT INTO subscriber (name, email, token, timestamp, confirmed, subscribedTo) VALUES (?, ?, ?, ?, 1, ?)", req.body.name, req.body.email, token, timestamp, req.body.subscribedTo);
        res.sendStatus(200);
    } catch(e) {
        if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
            throw new HTTPError(409);
        }
        throw e;
    }
}

export function getSubscribers() {
    return db.all("SELECT * FROM subscriber WHERE confirmed = 1");
}

export function getSubscriber(token) {
    return db.get("SELECT * FROM subscriber WHERE token = ?", token) || {};
}

function removeExpiredSubscribers() {
    const week = 7 * 24 * 60 * 60;
    const expired = utils.getCurrentTimestamp() - week;
    db.run("DELETE FROM subscriber WHERE confirmed = 0 AND timestamp < ?", expired);
}

function validNewsletterType(subscribedTo) {
    return subscribedTo == 1 || subscribedTo == 2 || subscribedTo == 3;
}

async function sendMail(type, options) {
    const namedType = type == 1 ? "itf" : "improglycerin";
    try {
        return await transporter[namedType].send(options);
    } catch(e) {
        logger.error(`Failed to send email to ${options.to}:\n ${e.stack}`);
        logger.warn("Delaying next newsletter by 1 minute because of previous error");
        throw e;
    }
}
