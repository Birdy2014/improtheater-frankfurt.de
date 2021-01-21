const nodemailer = require("nodemailer");
const pug = require("pug");
const marked = require("marked");
const db = require("./db");
const utils = require("./utils");
const logger = require("./logger");
const config = require("../config.json");
const workshops = require("./workshops");

exports.transporter = nodemailer.createTransport(config.email);

exports.subscribe = async (req, res) => {
    // TODO: check email address, length limit name, sanitize name and email
    try {
        if (!req.body.name || !req.body.email) {
            res.status(400);
            res.send();
            return;
        }
        await removeExpiredSubscribers();
        let token = utils.generateToken(20);
        let timestamp = utils.getCurrentTimestamp();
        await db.run("INSERT INTO subscriber (name, email, token, timestamp) VALUES (?, ?, ?, ?)", req.body.name, req.body.email, token, timestamp);
        sendConfirmMail({ name: req.body.name, email: req.body.email, token });
        res.status(200);
        res.send();
    } catch(e) {
        if (e.errno === 19) {
            res.status(409);
            res.send();
        } else {
            res.status(500);
            res.send();
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
    if (!req.query.token) {
        res.redirect("/newsletter");
        return;
    }
    let subscriber = await db.get("SELECT name, email FROM subscriber WHERE token = ?", req.query.token);
    await db.run("DELETE FROM subscriber WHERE token = ?", req.query.token);
    res.redirect("/newsletter?unsubscribed=" + subscriber.email);
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
    await db.run("UPDATE workshop SET newsletterSent = 1 WHERE id = ?", workshop.id);
    res.sendStatus(200);
    // Send newsletter
    let baseUrl = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
    let logo = baseUrl + "/public/img/Improtheater-Frankfurt-Logo.png";
    let subscribers = await exports.getSubscribers();
    let reply = /\S+@\S+\.\S+/.test(workshop.email) ? workshop.email : "hallo@improglycerin.de";
    let website = baseUrl + "/workshop/" + workshop.id;
    for (let subscriber of subscribers) {
        try {
            let unsubscribe = baseUrl + "/api/newsletter/unsubscribe?token=" + subscriber.token;
            let subscribername = subscriber.name;
            let textColor = parseInt(workshop.color.substr(1, 2), 16) + parseInt(workshop.color.substr(3, 2), 16) + parseInt(workshop.color.substr(5, 2), 16) > 382 ? "#000000" : "#ffffff";
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
                logo,
                subscribername,
                marked,
                textColor,
                website: website + "?token=" + subscriber.token,
            });
            await exports.transporter.sendMail({
                from: config.email.from,
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

function sendConfirmMail(subscriber) {
    let url = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
    let link = url + "/api/newsletter/confirm?token=" + subscriber.token;
    let html = pug.renderFile(__dirname + "/../client/views/emails/confirm.pug", { name: subscriber.name, link });
    exports.transporter.sendMail({
        from: config.email.from,
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
