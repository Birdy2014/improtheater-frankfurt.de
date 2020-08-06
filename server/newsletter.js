const nodemailer = require("nodemailer");
const es6Renderer = require('express-es6-template-engine');
const db = require("./db");
const utils = require("./utils");
const config = require("../config.json");

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
            text: ""
        });
    });
}

exports.getSubscribers = async () => {
    return await db.all("SELECT name, email FROM subscriber WHERE confirmed = 1");
}

exports.getSubscriber = async (token) => {
    return await db.get("SELECT * FROM subscriber WHERE token = ?", token) || {};
}

async function removeExpiredSubscribers() {
    let expired = utils.getCurrentTimestamp() - 86400;
    await db.run("DELETE FROM subscriber WHERE confirmed = 0 AND timestamp < ?", expired);
}