import bcrypt from "bcrypt"
import * as db from "./db.js";
import * as utils from "./utils.js";

const loggedInRoutes = [ "/uploads", "/subscribers" ];

const session_expiration_time = 10 * 24 * 60 * 60;

export async function getUser(req, res, next) {
    try {
        const session_token = req.cookies.session;

        // Get user info
        if (session_token) {
            const session = db.get("SELECT * FROM session WHERE token = ?", session_token);
            if (session && session.expires > utils.getCurrentTimestamp()) {
                req.user = db.get("SELECT * FROM user WHERE id = ?", session.user_id);
                if (req.user) {
                    db.run("UPDATE session SET expires = ? WHERE token = ?", utils.getCurrentTimestamp() + session_expiration_time, session_token);

                    next();
                    return;
                }
            }
        }

        if (!loggedInRoutes.includes(req.path)) {
            next();
            return;
        }

        // Log in
        const partial = req.query.partial;
        if (partial) {
            // Or return 403 and let client redirect?
            res.sendStatus(401);
        } else {
            res.redirect(`/login`);
        }
    } catch (e) {
        console.error(e);
        res.status(500);
        res.send("Internal Server Error");
        return;
    }
}

export async function login(req, res) {
    const login = req.body.login;
    const password = req.body.password;

    const user = db.get("SELECT id, password_hash FROM user WHERE username = ? OR email = ?", login, login);
    if (!user) {
        res.status(403);
        res.send();
        return;
    }

    if (await bcrypt.compare(password, user.password_hash)) {
        // TODO: use the crypto library to generate the token
        const session_token = utils.generateToken(20);
        db.run("INSERT INTO session (user_id, token, expires) VALUES (?, ?, ?)", user.id, session_token, utils.getCurrentTimestamp() + session_expiration_time);
        res.cookie("session", session_token);
        res.status(200);
        res.send();
    } else {
        res.status(403);
        res.send();
    }
}

export async function logout(req, res) {
    const session_token = req.cookies.session;

    if (!session_token) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    try {
        db.run("DELETE FROM session WHERE token = ?", session_token);
        res.clearCookie("session");
        res.status(200);
        res.json({ status: 200 });
    } catch(e) {
        res.status(500);
        res.json({ status: 500 });
    }
}
