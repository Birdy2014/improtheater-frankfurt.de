const nodemailer = require("nodemailer");
const es6Renderer = require('express-es6-template-engine');
const db = require("./db");
const utils = require("./utils");
const config = require("../config.json");
const workshops = require("./workshops");

exports.transporter = nodemailer.createTransport(config.email);

exports.subscribe = async (req, res) => {
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
    await db.run("UPDATE workshop SET newsletterSent = 1 WHERE created = ?", workshop.created);
    let baseUrl = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
    let logo = baseUrl + "/public/img/logo.jpg";
    let subscribers = await exports.getSubscribers();
    for (let subscriber of subscribers) {
        let unsubscribe = baseUrl + "/api/newsletter/unsubscribe?token=" + subscriber.token;
        let subscribername = subscriber.name;
        es6Renderer(__dirname + "/../client/views/emails/newsletter.html", { locals: { ...workshop, unsubscribe, logo, subscribername } }, (err, content) => {
            exports.transporter.sendMail({
                from: config.email.from,
                to: subscriber.email,
                subject: workshop.title + ", am " + workshop.dateText,
                html: content,
                text: `Improglycerin lädt ein zu ${workshop.title} am ${workshop.dateText}.\n\n${workshop.content}\n\nWann? ${workshop.timeText}\nWo? ${workshop.location}\nBetrag ${workshop.price}\n\nImpressum: https://improglycerin.de/impressum\nDatenschutz: https://improglycerin.de/datenschutz\nKontakt: https://improglycerin.de/kontakt/\nAbmelden: ${unsubscribe}`
            });
        });
    }
    res.sendStatus(200);
}

function sendConfirmMail(subscriber) {
    let url = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
    let link = url + "/api/newsletter/confirm?token=" + subscriber.token;
    es6Renderer(__dirname + "/../client/views/emails/confirm.html", { locals: { name: subscriber.name, link } }, (err, content) => {
        exports.transporter.sendMail({
            from: config.email.from,
            to: subscriber.email,
            subject: "Improtheater Frankfurt Newsletterbestätigung",
            html: content,
            text: `Liebe/r ${subscriber.name},\nvielen Dank für die Bestellung unseres Newsletters, in dem Du zukünftig über unsere Workshops, unsere Jams und unsere Shows informiert wirst.\nBitte bestätige durch Klick auf diesen Link, dass Du unseren tollen Newsletter erhalten möchtest: ${link}`
        });
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