const axios = require("axios").default;
const db = require("./db");
const config = require("../config.json");

exports.signup = async (req, res) => {
    if (!req.body.email || !req.body.name) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    // check if email address is already in the list
    try {
        await sendMailjetRequest("get", "/REST/contact/" + req.body.email, undefined);
        res.status(409);
        res.json({ status: 409, error: "Already subscribed" });
        return;
    } catch(e) {}

    try {
        // check if email address is already in db
        let result = await db.query(`SELECT * FROM Newsletter WHERE email = '${req.body.email}'`);
        if (result !== {}) {
            res.status(409);
            res.json({ status: 409, error: "Verification email sent" });
            return;
        }

        // store in db
        let token = generateRandomString(20);
        await db.query(`INSERT INTO Newsletter (token, email, name) VALUES ('${token}', '${req.body.email}', '${req.body.name}')`);

        // send email
        await sendMailjetRequest("post", "/send", {
            FromEmail: config.mailjet.email,
            FromName: config.mailjet.name,
            Subject: config.mailjet.subject,
            "Mj-TemplateID": config.mailjet.template,
            "Mj-TemplateLanguage": true,
            Vars: {
                name: req.body.name,
                email: req.body.email,
                url: "https://improtheater-frankfurt.de/api/newsletter?token=" + token
            },
            Recipients: [
                {
                    Email: req.body.email
                }
            ]
        });

        res.status(200);
        res.json({ status: 200 });
    } catch(e) {
        console.error(e);
        res.status(500);
        res.json({ status: 500 });
    }
}

exports.verify = async (req, res) => {
    if (!req.query.token) {
        res.redirect("/newsletter?success=false");
        return;
    }

    try {
        let { email, name } = await db.query(`SELECT * FROM Newsletter WHERE token = '${token}'`);
        if (!email || !name) {
            res.redirect("/newsletter?success=false");
            return;
        }

        // add to mailjet list
        await sendMailjetRequest("post", "/REST/contact", {
            IsExcludedFromCampaigns: false,
            Name: req.body.name,
            Email: req.body.email
        });

        await sendMailjetRequest("post", "/REST/listrecipient", {
            IsUnsubscribed: false,
            ContactAlt: req.body.email,
            ListID: config.ListID
        });

        res.redirect("/newsletter?success=true&email" + email);
    } catch (e) {
        res.redirect("/newsletter?success=false");
    }
}

function generateRandomString(length) {
    let str = "";
    let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
}

function sendMailjetRequest(method, endpoint, data) {
    return axios({
        method: method,
        url: "https://api.mailjet.com/v3" + endpoint,
        data: data,
        auth: {
            username: config.mailjet.apikey_public,
            password: config.mailjet.apikey_private
        }
    });
}
