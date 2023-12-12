import assert from "assert";
import bcrypt from "bcrypt"
import { v4 as uuid } from "uuid";
import * as db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js"
import { EMailTransporter } from "./mail.js";

const loggedInRoutes = [ "/uploads", "/subscribers", "/user" ];

const session_expiration_time = 10 * 24 * 60 * 60;

const transporter = new EMailTransporter("auth");

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
        const session_token = await create_session(user.id, session_expiration_time);
        res.cookie("session", session_token);
        res.status(200);
        res.send();
    } else {
        logger.warn(`Failed login attempt for user '${login}' from '${req.ip}'`);
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

    db.run("DELETE FROM session WHERE token = ?", session_token);
    res.clearCookie("session");
    res.status(200);
    res.send();
}

export async function api_create_user(req, res) {
    if (!req.user || !req.user.admin) {
        res.status(403);
        res.send();
        return;
    }

    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    const admin = (req.body.admin ?? false) ? 1 : 0;
    const full_access = (req.body.full_access ?? false) ? 1 : 0;

    if (!email || !username || !password) {
        res.status(400);
        res.send();
        return;
    }

    if (password.length < 8) {
        res.status(400);
        res.send("Password too short");
        return;
    }

    const id = uuid();
    const password_hash = await bcrypt.hash(password, 12);

    db.run("INSERT INTO user (id, username, email, password_hash, admin, full_access) VALUES (?, ?, ?, ?, ?, ?)", id, username, email, password_hash, admin, full_access);

    res.status(200);
    res.send();
}

export async function api_change_user(req, res) {
    if (!req.user) {
        res.status(403);
        res.send();
        return;
    }

    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;

    // TODO: use booleans
    let admin = req.body.admin;
    switch (admin) {
        case true:
        case 1:
            admin = 1;
            break;
        case false:
        case 0:
            admin = 0;
            break;
        default:
            admin = undefined;
    }

    let full_access = req.body.admin;
    switch (full_access) {
        case true:
        case 1:
            full_access = 1;
            break;
        case false:
        case 0:
            full_access = 0;
            break;
        default:
            full_access = undefined;
    }

    if (!email && !username && !password && admin === undefined && full_access === undefined) {
        res.status(400);
        res.send();
        return;
    }

    let id = req.body.id;
    if (id) {
        if (!req.user.admin) {
            res.status(403);
            res.send();
            return;
        }
        if (!db.get("SELECT 1 FROM user WHERE id = ?", id)) {
            res.status(404);
            res.send();
            return;
        }
    } else {
        id = req.user.id;
    }

    if (email) {
        db.run("UPDATE user SET email = ? WHERE id = ?", email, id);
    }
    if (username) {
        db.run("UPDATE user SET username = ? WHERE id = ?", username, id);
    }
    if (password) {
        if (password.length < 8) {
            res.status(400);
            res.send("Password too short");
            return;
        }
        const password_hash = await bcrypt.hash(password, 12);
        db.run("UPDATE user SET password_hash = ? WHERE id = ?", password_hash, id);
    }
    if (admin !== undefined && req.user.admin) {
        db.run("UPDATE user SET admin = ? WHERE id = ?", admin, id)
    }
    if (full_access !== undefined && req.user.admin) {
        db.run("UPDATE user SET full_access = ? WHERE id = ?", full_access, id)
    }
    res.status(200);
    res.send();
}

export async function api_delete_user(req, res) {
    const id = req.body.id;

    if (!id) {
        res.status(400);
        res.send();
        return;
    }

    if (!req.user.admin) {
        res.status(403);
        res.send();
        return;
    }

    db.run("DELETE FROM user WHERE id = ?", id);

    res.status(200);
    res.send();
}

export async function api_request_password_reset(req, res) {
    const login = req.body.login;
    if (!login) {
        res.status(400);
        res.send();
        return;
    }
    const user = db.get("SELECT id, username, email FROM user WHERE username = ? OR email = ?", login, login);
    if (!user) {
        // Return 200 to hide existing accounts?
        res.status(404);
        res.send();
        return;
    }

    const session_token = await create_session(user.id, 30 * 60);
    const reset_url = `${utils.base_url}/password_reset?token=${session_token}`;

    transporter.send({
        to: user.email,
        subject: "Passwort reset",
        text: `Hallo ${user.username}, reset url: ${reset_url}`
    });
}

export async function api_password_reset(req, res) {
    const token = req.body.token;
    const new_password = req.body.password;

    if (!token || !new_password) {
        res.status(400);
        res.send();
        return;
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    const session = db.get("SELECT user_id FROM session WHERE token = ?", token);

    if (!session) {
        res.status(400);
        res.send();
        return;
    }

    db.run("UPDATE user SET password_hash = ? WHERE id = ?", password_hash, session.user_id);

    db.run("DELETE FROM session WHERE token = ?", token);

    res.status(200);
    res.send();
}

/**
 * @param {string} user_id
 * @param {number} expiration_time
 * @returns {Promise<string>} session_token
 */
async function create_session(user_id, expiration_time) {
    assert.strictEqual(typeof user_id, "string");
    assert.strictEqual(typeof expiration_time, "number");

    const session_token = utils.generateToken(20);
    db.run("INSERT INTO session (user_id, token, expires) VALUES (?, ?, ?)", user_id, session_token, utils.getCurrentTimestamp() + expiration_time);
    return session_token;
}

export function get_users() {
    return db.all("SELECT * FROM user");
}

export function clear_expired_sessions() {
    db.run("DELETE FROM session WHERE expires < ?", utils.getCurrentTimestamp());
}
