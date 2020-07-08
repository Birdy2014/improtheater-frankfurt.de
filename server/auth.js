const axios = require("axios").default;
const crypto = require("crypto");
const config = require("../config.json");

let loggedInRoutes = [ "/admin", "/api/login" ];

exports.users = {};

function generateToken(length) {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    let text = "";
    for (let i = 0; i < length; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}

exports.authhook = async (req, res) => {
    if (!req.query.state || !req.query.authorization_code) {
        res.status(400);
        res.send("Invalid request");
        return;
    }

    let code_verifier = exports.users[req.query.state];
    if (!code_verifier) {
        res.status(403);
        res.send("Invalid state");
        return;
    }
    delete exports.users[req.query.state];

    try {
        let response = await axios.post(`${config.auth.url}/api/token`, {
            grant_type: "authorization_code",
            client_id: config.auth.client_id,
            client_secret: config.auth.client_secret,
            code: req.query.authorization_code,
            code_verifier: code_verifier
        });
        res.cookie("access_token", response.data.data.access_token, { maxAge: response.data.data.expires * 1000 });
        res.cookie("refresh_token", response.data.data.refresh_token);
        res.clearCookie("route")
        res.redirect(req.cookies.route || "/");
    } catch(e) {
        console.error(e);
        res.status(500);
        res.send("Something went wrong: \n\n" + JSON.stringify(e, null, 4));
    }
}

async function getUserInfo(access_token) {
    try {
        let result = await axios.post(config.auth.url + "/api/token_info", {
            client_id: config.auth.client_id,
            client_secret: config.auth.client_secret,
            access_token: access_token
        });
        return result.data.data;
    } catch(e) {
        if (e.response.data.error === "Invalid access_token") {
            return { active: false };
        } else {
            throw e;
        }
    }
}

exports.getUser = async (req, res, next) => {
    let token = req.header("Authorization") || req.cookies.access_token;
    let refresh_token = req.cookies.refresh_token;

    // Get user info
    if (token) {
        try {
            let user = await getUserInfo(token);

            if (user.active) {
                req.user = user;
                next();
                return;
            } else {
                token = undefined;
                res.clearCookie("access_token");
            }
        } catch (e) {
            console.error(e);
            res.status(500);
            res.send("Internal Server Error");
            return;
        }
    }

    // Refresh access token
    if (!token && refresh_token) {
        try {
            let response = await axios.post(`${config.auth.url}/api/token`, {
                grant_type: "refresh_token",
                client_id: config.auth.client_id,
                refresh_token: refresh_token
            });
            token = response.data.data.access_token;
            res.cookie("access_token", token, { maxAge: response.data.data.expires * 1000 });
            req.user = await getUserInfo(token);
            next();
        } catch(e) {
            token = undefined;
            refresh_token = undefined;
            res.clearCookie("access_token");
            res.clearCookie("refresh_token");
        }
    }

    // Log in
    if (!token && !refresh_token) {
        if (!loggedInRoutes.includes(req.path)) {
            next();
            return;
        }
        let state = generateToken(10);
        let code_verifier = generateToken(10);
        let code_challenge = crypto.createHash("sha256").update(code_verifier).digest("base64").replace(/\+/g, "_");
        exports.users[state] = code_verifier;
        let redirect_base_uri = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de"
        res.redirect(`${config.auth.url}/authorize?client_id=${config.auth.client_id}&redirect_uri=${redirect_base_uri + "/api/authhook"}&state=${state}&code_challenge=${code_challenge}&code_challenge_method=S256`);
        return;
    }
}

exports.logout = async (req, res) => {
    if (!req.cookies.access_token && !req.cookies.refresh_token) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    try {
        await axios.delete(`${config.auth.url}/api/token`, {
            data: {
                access_token: req.cookies.access_token,
                refresh_token: req.cookies.refresh_token
            }
        });
        res.clearCookie("access_token");
        res.clearCookie("refresh_token");
        res.status(200);
        res.json({ status: 200 });
    } catch(e) {
        res.status(500);
        res.json({ status: 500 });
    }
}
