import pug from "pug";
import { marked } from "marked";
import { Mutex } from "async-mutex";
import * as db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import * as workshops from "./workshops.js";
import { EMailTransporter } from "./mail.js";

const transporter = {
    itf: new EMailTransporter("itf"),
    improglycerin: new EMailTransporter("improglycerin"),
};

const mail_mutex = new Mutex();

export function subscribe(req, res) {
    // TODO: check email address, length limit name, sanitize name and email
    try {
        if (req.body.subscribedTo)
            req.body.subscribedTo &= 3;

        if (((!req.body.name || !req.body.email) && !req.body.token) || !req.body.subscribedTo || !validNewsletterType(req.body.subscribedTo)) {
            res.status(400);
            res.send();
            return;
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
        res.status(200);
        res.send();
    } catch(e) {
        if (e.errno === 19) {
            res.status(409);
            res.send();
        } else {
            res.status(500);
            res.send();
            logger.error(e);
        }
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
    if (!req.body.token)
        return res.sendStatus(400);

    let subscriber = getSubscriber(req.body.token);
    if (!subscriber)
        return res.sendStatus(404);

    const unsubscribeFrom = req.body.type || 0xFF

    const newSubscribedTo = subscriber.subscribedTo & ~unsubscribeFrom;
    if (newSubscribedTo)
        db.run("UPDATE subscriber SET subscribedTo = ? WHERE token = ?", newSubscribedTo, req.body.token);
    else
        db.run("DELETE FROM subscriber WHERE token = ?", req.body.token);
    res.sendStatus(200);
}

export async function send(req, res) {
    if (!req.user || !req.body.workshops) {
        res.sendStatus(400);
        return;
    }

    const workshops_to_send = [];

    let workshop_type = undefined;
    for (const workshop_id of req.body.workshops) {
        const workshop = workshops.getWorkshop(workshop_id, req.body.test); // Testmail can be sent without publishing
        if (!workshop) {
            res.sendStatus(404);
            return;
        }
        if (workshop.newsletterSent && !req.user.full_access) {
            res.sendStatus(409);
            return;
        }

        if (workshop_type === undefined) {
            workshop_type = workshop.type;
        } else if (workshop_type !== workshop.type) {
            res.status(400).send("Mismatching workshop types.");
        }

        // FIXME: Check for duplicates

        {
            const error_message = workshops.not_ready_for_publishing_error(workshop)
            if (error_message) {
                res.status(400).send(error_message);
                return;
            }
        }
        workshops_to_send.push(workshop);
    }

    let subscribers = [];
    if (req.body.test) {
        subscribers[0] = {
            name: req.user.username,
            email: req.user.email,
            token: "",
            subscribedTo: 3
        };
    } else {
        for (const workshop of workshops_to_send) {
            db.run("UPDATE workshop SET newsletterSent = 1 WHERE id = ?", workshop.id);
        }
        subscribers = getSubscribers();
    }
    res.sendStatus(200);

    // Send newsletter
    const logo = workshop_type === workshops.type_itf
        ? utils.config.base_url + "/public/img/improtheater_frankfurt_logo.png"
        : "https://improglycerin.de/wp-content/uploads/2017/04/improglycerin_logo_website_white_medium_2.jpg";

    logger.info(`Start sending newsletter ${workshops_to_send.map(workshop => workshop.id).join(", ")}`);

    for (let subscriber of subscribers) {
        if (!(subscriber.subscribedTo & workshop_type))
            continue;

        try {
            const unsubscribe = utils.config.base_url + "/newsletter?unsubscribe=1&token=" + subscriber.token;
            const subscribe = utils.config.base_url + "/newsletter?subscribe=1&token=" + subscriber.token;
            const workshops_for_subscriber = workshops_to_send.map(workshop => {
                return {
                    ...workshop,
                    textColor: calcTextColor(workshop.color),
                    website: `${utils.config.base_url}/workshop/${workshop.id}?token=${subscriber.token}`,
                    img_url: `${utils.config.base_url}/api/upload/${workshop.id}?token=${subscriber.token}`,
                }
            });

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
                marked,
                base_url: utils.config.base_url
            });

            const text =
                workshops_for_subscriber.map(workshop =>
                    workshop.propertiesHidden
                    ? `${workshop.title}\n\n${workshop.content}`
                    : `Im Browser anschauen: ${weblink}\n\nImproglycerin lädt ein zu ${workshop.title} am ${workshop.dateText}.\n\n${workshop.content}\n\nWann? ${workshop.timeText}\nWo? ${workshop.location}\nBetrag ${workshop.price}`
                ).join("\n\n")
                + `\n\nImpressum: https://improtheater-frankfurt.de/impressum\nDatenschutz: https://improglycerin.de/datenschutz\nKontakt: https://improglycerin.de/kontakt/\nAbmelden: ${unsubscribe}`;

            const smtp_response = await sendMail(workshop_type, {
                to: subscriber.email,
                replyTo: "hallo@improglycerin.de",
                subject,
                html,
                text
            });
            logger.info(`Sent newsletter ${workshops_to_send.map(workshop => workshop.id).join(", ")} to ${subscriber.email}. Got response '${smtp_response}'`);
        } catch (e) {
            logger.error(`Failed to send Newsletter ${workshops_to_send.map(workshop => workshop.id).join(", ")} to ${subscriber.email}:\n ${e.stack}`);
        }
    }

    logger.info(`Sent newsletter ${workshops_to_send.map(workshop => workshop.id).join(", ")}`);
}

export function exportSubscribers(req, res) {
    if (!req.user)
        return res.sendStatus(403);

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
    res.status(200);
    res.send(csv);
}

export function addSubscriber(req, res) {
    if (!req.user)
        return res.sendStatus(403);

    if (!req.body.name || !req.body.email || !req.body.subscribedTo || !validNewsletterType(req.body.subscribedTo))
        return res.sendStatus(400);

    try {
        removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = utils.getCurrentTimestamp();
        db.run("INSERT INTO subscriber (name, email, token, timestamp, confirmed, subscribedTo) VALUES (?, ?, ?, ?, 1, ?)", req.body.name, req.body.email, token, timestamp, req.body.subscribedTo);
        res.sendStatus(200);
    } catch(e) {
        if (e.errno === 19) {
            res.sendStatus(409);
        } else {
            res.sendStatus(500);
        }
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
    const smtp_response = await transporter[namedType].send(options);
    await utils.sleep(2000);
    mail_mutex.release();
    return smtp_response;
}

export function calcTextColor(backgroundColor) {
    const r = parseInt(backgroundColor.substr(1, 2), 16);
    const g = parseInt(backgroundColor.substr(3, 2), 16);
    const b = parseInt(backgroundColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.5)
        return "#000000";
    else
        return "#ffffff";
}
