const nodemailer = require("nodemailer");
const pug = require("pug");
const marked = require("marked");
const db = require("./db");
const utils = require("./utils");
const logger = require("./logger");
const config = require("../config.json");
const workshops = require("./workshops");

const type_itf = 1;
const type_improglycerin = 2;

exports.transporter = [];
for (const email of config.email)
    exports.transporter.push(nodemailer.createTransport(email));

exports.subscribe = async (req, res) => {
    // TODO: check email address, length limit name, sanitize name and email
    try {
        if (req.body.subscribedTo)
            req.body.subscribedTo &= 3;

        if (((!req.body.name || !req.body.email) && !req.body.token) || !req.body.subscribedTo || !checkNewsletterType(req.body.subscribedTo)) {
            res.status(400);
            res.send();
            return;
        }

        // User is already subscribed
        if (req.body.token) {
            const subscriber = await exports.getSubscriber(req.body.token);
            if (req.body.subscribedTo == subscriber.subscribedTo)
                return res.sendStatus(200);
            await db.run("UPDATE subscriber SET subscribedTo = ? WHERE token = ?", req.body.subscribedTo, req.body.token);
            return res.sendStatus(200);
        }

        // User is not subscribed
        await removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = utils.getCurrentTimestamp();
        await db.run("INSERT INTO subscriber (name, email, token, timestamp, subscribedTo) VALUES (?, ?, ?, ?, ?)", req.body.name, req.body.email, token, timestamp, req.body.subscribedTo);
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
            console.log(e+ "\n");
        }
    }
}

exports.confirm = async (req, res) => {
    if (!req.query.token) {
        res.redirect("/newsletter");
        return;
    }
    await db.run("UPDATE subscriber SET confirmed = 1 WHERE token = ?", req.query.token);
    res.redirect("/newsletter?token=" + req.query.token);
}

exports.unsubscribe = async (req, res) => {
    if (!req.body.token)
        return res.sendStatus(400);

    let subscriber = await exports.getSubscriber(req.body.token);
    if (!subscriber)
        return res.sendStatus(404);

    const unsubscribeFrom = req.body.type || 0xFF

    const newSubscribedTo = subscriber.subscribedTo & ~unsubscribeFrom;
    if (newSubscribedTo)
        await db.run("UPDATE subscriber SET subscribedTo = ? WHERE token = ?", newSubscribedTo, req.body.token);
    else
        await db.run("DELETE FROM subscriber WHERE token = ?", req.body.token);
    res.sendStatus(200);
}

exports.send = async (req, res) => {
    if (!req.user || !req.body.workshop) {
        res.sendStatus(400);
        return;
    }

    let workshop = await workshops.getWorkshop(req.body.workshop, false);
    if (!workshop) {
        res.sendStatus(404);
        return;
    }
    if (workshop.newsletterSent) {
        res.sendStatus(409);
        return;
    }
    if (workshop.title === workshops.defaultTitle || workshop.content === workshops.defaultContent) {
        res.status(400).send("Der Workshop enthält Standartwerte");
        return;
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
        await db.run("UPDATE workshop SET newsletterSent = 1 WHERE id = ?", workshop.id);
        subscribers = await exports.getSubscribers();
    }
    res.sendStatus(200);
    // Send newsletter
    let baseUrl = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
    let logo = "https://improglycerin.de/wp-content/uploads/2017/04/improglycerin_logo_website_white_medium_2.jpg";
    if (workshop.type == type_itf)
        logo = baseUrl + "/public/img/Improtheater-Frankfurt-Logo.png";
    let reply = /\S+@\S+\.\S+/.test(workshop.email) ? workshop.email : "hallo@improglycerin.de";
    let website = baseUrl + "/workshop/" + workshop.id;
    for (let subscriber of subscribers) {
        if (!(subscriber.subscribedTo & workshop.type))
            continue;
        try {
            let unsubscribe = baseUrl + "/newsletter?unsubscribe=1&token=" + subscriber.token;
            let subscribe = baseUrl + "/newsletter?subscribe=1&token=" + subscriber.token;
            let textColor = exports.calcTextColor(workshop.color);
            let html = pug.renderFile(__dirname + "/../client/views/emails/newsletter.pug", {
                title: workshop.title,
                img: workshop.img + "&token=" + subscriber.token,
                dateText: workshop.dateText,
                timeText: workshop.timeText,
                location: workshop.location,
                price: workshop.price,
                email: workshop.email,
                content: workshop.content,
                color: workshop.color,
                textColor: workshop.textColor,
                unsubscribe,
                subscribe,
                logo,
                subscriber,
                marked,
                textColor,
                website: website + "?token=" + subscriber.token,
            });
            await sendMail(workshop.type, {
                to: subscriber.email,
                replyTo: reply,
                subject: workshop.title + ", am " + workshop.dateText,
                html: html,
                text: `Improglycerin lädt ein zu ${workshop.title} am ${workshop.dateText}.\n\n${workshop.content}\n\nWann? ${workshop.timeText}\nWo? ${workshop.location}\nBetrag ${workshop.price}\n\nImpressum: https://improglycerin.de/impressum\nDatenschutz: https://improglycerin.de/datenschutz\nKontakt: https://improglycerin.de/kontakt/\nAbmelden: ${unsubscribe}`
            });
            await utils.sleep(1000);
        } catch (e) {
            console.log(e);
            logger.error(`Failed to send Newsletter of workshop ${workshop.id} to ${subscriber.email}:\n ${JSON.stringify(e)}`);
        }
    }
}

exports.exportSubscribers = async (req, res) => {
    if (!req.user)
        return res.sendStatus(403);

    let subscribers = await exports.getSubscribers();
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

exports.addSubscriber = async (req, res) => {
    if (!req.user)
        return res.sendStatus(403);

    if (!req.body.name || !req.body.email || !req.body.subscribedTo || !checkNewsletterType(req.body.subscribedTo))
        return res.sendStatus(400);

    try {
        await removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = utils.getCurrentTimestamp();
        await db.run("INSERT INTO subscriber (name, email, token, timestamp, confirmed, subscribedTo) VALUES (?, ?, ?, ?, 1, ?)", req.body.name, req.body.email, token, timestamp, req.body.subscribedTo);
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
    let url = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
    let link = url + "/api/newsletter/confirm?token=" + subscriber.token;
    let html = pug.renderFile(__dirname + "/../client/views/emails/confirm.pug", { name: subscriber.name, link });
    sendMail(subscriber.subscribedTo, {
        to: subscriber.email,
        subject: "Improtheater Frankfurt Newsletterbestätigung",
        html: html,
        text: `Liebe/r ${subscriber.name},\nvielen Dank für die Bestellung unseres Newsletters, in dem Du zukünftig über unsere Workshops, unsere Jams und unsere Shows informiert wirst.\nBitte bestätige durch Klick auf diesen Link, dass Du unseren tollen Newsletter erhalten möchtest: ${link}`
    });
}

exports.getSubscribers = async () => {
    return await db.all("SELECT * FROM subscriber WHERE confirmed = 1");
}

exports.getSubscriber = async (token) => {
    return await db.get("SELECT * FROM subscriber WHERE token = ?", token) || {};
}

async function removeExpiredSubscribers() {
    let expired = utils.getCurrentTimestamp() - 86400;
    await db.run("DELETE FROM subscriber WHERE confirmed = 0 AND timestamp < ?", expired);
}

function checkNewsletterType(subscribedTo) {
    for (let i = 0; i < config.email.length; i++) {
        if (subscribedTo & (1 << i))
            return true;
    }
    return false;
}

async function sendMail(type, options) {
    let i;
    for (i = exports.transporter.length; !(type & (1 << i)) && i >= 0; i--);
    if (i < 0)
        return false;
    const newOptions = Object.assign({ from: config.email[i].from }, options);
    await exports.transporter[i].sendMail(newOptions);
    return true;
}

exports.calcTextColor = (backgroundColor) => {
    const r = parseInt(backgroundColor.substr(1, 2), 16);
    const g = parseInt(backgroundColor.substr(3, 2), 16);
    const b = parseInt(backgroundColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.5)
        return "#000000";
    else
        return "#ffffff";
}
