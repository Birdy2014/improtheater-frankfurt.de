import assert from "assert";
import pug from "pug";
import { Marked } from "marked";
import { Mutex } from "async-mutex";
import { SqliteError } from "better-sqlite3";
import db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import * as workshops from "./workshops.js";
import { EMailTransporter } from "./mail.js";
import { calcTextColor } from "../common/color.js";

const transporter = {
    itf: new EMailTransporter("itf"),
    improglycerin: new EMailTransporter("improglycerin"),
};

const mail_mutex = new Mutex();

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
        db.run("INSERT INTO subscriber (name, email, token, timestamp, subscribedTo) VALUES (?, ?, ?, ?, ?)", req.body.name, req.body.email, token, timestamp, req.body.subscribedTo);
        sendConfirmMail({ name: req.body.name, email: req.body.email, token, subscribedTo: req.body.subscribedTo });
        res.sendStatus(200);
    } catch(e) {
        if (e instanceof SqliteError && e.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
            throw new utils.HTTPError(409);
        }
        throw e;
    }
}

export function confirm(req, res) {
    if (!req.query.token) {
        res.redirect("/newsletter");
        return;
    }
    db.run("UPDATE subscriber SET confirmed = 1 WHERE token = ?", req.query.token);
    res.redirect("/newsletter?token=" + req.query.token);
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

/**
 * Instanciates the templates for the given workshops to be sent to the given subscribers
 * @param {number[]} workshop_ids
 * @param {{email: string, name: string, subscribedTo: number, token: string}[]} subscribers
 * @param {boolean} allow_resend
 * @yields {{email: string, type: number, subject: string, text: string, html: string}}
 * @throws {utils.HTTPError}
 */
function *build_newsletters(workshop_ids, subscribers, allow_resend) {
    assert(Array.isArray(workshop_ids));
    assert(Array.isArray(subscribers));
    assert.notStrictEqual(workshop_ids.length, 0);
    assert.notStrictEqual(subscribers.length, 0);

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

    const logo = workshop_type === workshops.type_itf
        ? utils.config.base_url + "/public/img/improtheater_frankfurt_logo.png"
        : "https://improglycerin.de/wp-content/uploads/2017/04/improglycerin_logo_website_white_medium_2.jpg";

    for (const subscriber of subscribers.filter(({subscribedTo}) => subscribedTo & workshop_type)) {
        const unsubscribe = utils.config.base_url + "/newsletter?unsubscribe=1&token=" + subscriber.token;
        const subscribe = utils.config.base_url + "/newsletter?subscribe=1&token=" + subscriber.token;
        const workshops_for_subscriber = workshops_to_send.map(workshop => ({
            ...workshop,
            textColor: calcTextColor(workshop.color),
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
            subscribe,
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

        yield {
            email: subscriber.email,
            type: workshop_type,
            subject,
            text,
            html,
        };
    }
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

    const newsletters = build_newsletters(workshop_ids_to_send, subscribers, true);
    res.sendStatus(200);

    // Send newsletter
    logger.info(`Start sending newsletter ${workshop_ids_to_send.join(", ")}`);

    for (const newsletter of newsletters) {
        try {
            const smtp_response = await sendMail(newsletter.type, {
                to: newsletter.email,
                replyTo: "hallo@improglycerin.de",
                subject: newsletter.subject,
                html: newsletter.html,
                text: newsletter.text
            });
            logger.info(`Sent newsletter ${workshop_ids_to_send.join(", ")} to ${newsletter.email}. Got response '${smtp_response}'`);
        } catch (e) {
            logger.error(`Failed to send Newsletter ${workshop_ids_to_send.join(", ")} to ${newsletter.email}:\n ${e.stack}`);
        }
    }

    logger.info(`Sent newsletter ${workshop_ids_to_send.join(", ")}`);
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

    const subscribers = [{
        name: req.user.username,
        email: req.user.email,
        token: "",
        subscribedTo: 3
    }];

    const newsletters = build_newsletters(workshop_ids_to_send, subscribers, true);

    res.send(newsletters.next().value.html);
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

function sendConfirmMail(subscriber) {
    let link = utils.config.base_url + "/api/newsletter/confirm?token=" + subscriber.token;
    let subscribe = utils.config.base_url + "/newsletter?subscribe=1&token=" + subscriber.token;
    let html = pug.renderFile(utils.project_path + "/client/views/emails/confirm.pug", {
        name: subscriber.name,
        link,
        subscribedTo: subscriber.subscribedTo,
        subscribe,
    });
    sendMail(subscriber.subscribedTo, {
        to: subscriber.email,
        replyTo: "hallo@improglycerin.de",
        subject: "Improtheater Frankfurt Newsletterbestätigung",
        html: html,
        text: `Liebe/r ${subscriber.name},\nvielen Dank für die Bestellung unseres Newsletters, in dem Du zukünftig über unsere Workshops, unsere Jams und unsere Shows informiert wirst.\nBitte bestätige durch Klick auf diesen Link, dass Du unseren tollen Newsletter erhalten möchtest: ${link}`
    });
}

export function getSubscribers() {
    return db.all("SELECT * FROM subscriber WHERE confirmed = 1");
}

export function getSubscriber(token) {
    return db.get("SELECT * FROM subscriber WHERE token = ?", token) || {};
}

function removeExpiredSubscribers() {
    let expired = utils.getCurrentTimestamp() - 86400;
    db.run("DELETE FROM subscriber WHERE confirmed = 0 AND timestamp < ?", expired);
}

function validNewsletterType(subscribedTo) {
    return subscribedTo == 1 || subscribedTo == 2 || subscribedTo == 3;
}

async function sendMail(type, options) {
    const namedType = type == 1 ? "itf" : "improglycerin";
    await mail_mutex.acquire();
    try {
        const smtp_response = await transporter[namedType].send(options);
        await utils.sleep(2_000);
        mail_mutex.release();
        return smtp_response;
    } catch(e) {
        logger.error(`Failed to send email to ${options.to}:\n ${e.stack}`);
        logger.warn("Delaying next newsletter by 1 minute because of previous error");
        await utils.sleep(60_000);
        mail_mutex.release();
        throw e;
    }
}
