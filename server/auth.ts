import assert from "assert";
import bcrypt from "bcryptjs"
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import db, { Session, User } from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js"
import { getCurrentTimestamp } from "../common/time";
import { EMailTransporter } from "./mail.js";

const loggedInRoutes = [ "/uploads", "/subscribers", "/user", "/newsletter_status" ];

const session_expiration_time = 10 * 24 * 60 * 60;
const login_rate_limit_window = 15 * 60;
const login_rate_limit_max_attempts = 5;

const login_attempts = new Map<string, { count: number; reset_at: number }>();

function record_failed_attempt(ip: string) {
    const now = getCurrentTimestamp();
    const entry = login_attempts.get(ip);
    if (!entry || now >= entry.reset_at) {
        login_attempts.set(ip, { count: 1, reset_at: now + login_rate_limit_window });
    } else {
        entry.count++;
    }
}

const transporter = new EMailTransporter("auth");

export async function getUser(req: Request, res: Response, next: NextFunction) {
    const session_token = req.cookies.session;

    // Get user info
    if (session_token) {
        const session = db.get<Session>("SELECT * FROM session WHERE token = ?", session_token);
        if (session && session.expires > getCurrentTimestamp()) {
            req.user = db.get("SELECT * FROM user WHERE id = ?", session.user_id);
            if (req.user) {
                db.run("UPDATE session SET expires = ? WHERE token = ?", getCurrentTimestamp() + session_expiration_time, session_token);

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
        throw new utils.HTTPError(401);
    } else {
        res.redirect(`/login`);
    }
}

export async function login(req: Request, res: Response) {
    const ip = req.ip!;
    const entry = login_attempts.get(ip);
    if (entry && getCurrentTimestamp() < entry.reset_at && entry.count >= login_rate_limit_max_attempts) {
        logger.warn(`Rate limited login attempt for ip '${ip}'`);
        throw new utils.HTTPError(429, "Zu viele Loginversuche");
    }

    const login = req.body.login;
    const password = req.body.password;

    const user = db.get<User>("SELECT id, password_hash FROM user WHERE username = ? OR email = ?", login, login);
    if (!user) {
        record_failed_attempt(ip);
        throw new utils.HTTPError(403);
    }

    if (!await bcrypt.compare(password, user.password_hash)) {
        record_failed_attempt(ip);
        logger.warn(`Failed login attempt for user '${login}' from '${req.ip}'`);
        throw new utils.HTTPError(403);
    }

    login_attempts.delete(ip);

    const session_token = await create_session(user.id, session_expiration_time);
    res.cookie("session", session_token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
    });
    res.sendStatus(200);
}

export async function logout(req: Request, res: Response) {
    const session_token = req.cookies.session;

    if (!session_token) {
        throw new utils.HTTPError(400);
    }

    db.run("DELETE FROM session WHERE token = ?", session_token);
    res.clearCookie("session");
    res.sendStatus(200);
}

export async function api_create_user(req: Request, res: Response) {
    if (!req.user || !req.user.admin) {
        throw new utils.HTTPError(403);
    }

    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;
    const admin = (req.body.admin ?? false) ? 1 : 0;

    if (!email || !username || !password) {
        throw new utils.HTTPError(400);
    }

    validate_password(password);

    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 12);

    db.run("INSERT INTO user (id, username, email, password_hash, admin) VALUES (?, ?, ?, ?, ?)", id, username, email, password_hash, admin);

    res.sendStatus(200);
}

export async function api_change_user(req: Request, res: Response) {
    if (!req.user) {
        throw new utils.HTTPError(403);
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

    if (!email && !username && !password && admin === undefined) {
        throw new utils.HTTPError(400);
    }

    let id = req.body.id;
    if (id) {
        if (!req.user.admin) {
            throw new utils.HTTPError(403);
        }
        if (!db.get("SELECT 1 FROM user WHERE id = ?", id)) {
            throw new utils.HTTPError(404);
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
        validate_password(password);
        const password_hash = await bcrypt.hash(password, 12);
        db.run("UPDATE user SET password_hash = ? WHERE id = ?", password_hash, id);
    }
    if (admin !== undefined && req.user.admin) {
        db.run("UPDATE user SET admin = ? WHERE id = ?", admin, id)
    }
    res.sendStatus(200);
}

export async function api_delete_user(req: Request, res: Response) {
    const id = req.body.id;

    if (!id) {
        throw new utils.HTTPError(400);
    }

    if (!req.user) {
        throw new utils.HTTPError(401);
    }

    if (!req.user.admin) {
        throw new utils.HTTPError(403);
    }

    db.run("DELETE FROM user WHERE id = ?", id);

    res.sendStatus(200);
}

export async function api_request_password_reset(req: Request, res: Response) {
    const login = req.body.login;
    if (!login) {
        throw new utils.HTTPError(400);
    }
    const user = db.get<User>("SELECT id, username, email FROM user WHERE username = ? OR email = ?", login, login);
    if (!user) {
        // Same response as in successful case to prevent account enumeration
        res.sendStatus(200);
        return;
    }

    const session_token = await create_session(user.id, 30 * 60);
    const reset_url = `${utils.config.base_url}/password_reset?token=${session_token}`;

    const smtp_response = await transporter.send({
        to: user.email,
        subject: "Passwort reset",
        text: `Hallo ${user.username}, reset url: ${reset_url}`
    });
    logger.info(`Password reset E-Mail and ${user.email} gesendet: ${smtp_response}`);

    res.sendStatus(200);
}

export async function api_password_reset(req: Request, res: Response) {
    const token = req.body.token;
    const new_password = req.body.password;

    if (!token || !new_password) {
        throw new utils.HTTPError(400);
    }

    validate_password(new_password);

    const password_hash = await bcrypt.hash(new_password, 12);

    const session = db.get<Session>("SELECT user_id, expires FROM session WHERE token = ?", token);

    if (!session || session.expires < getCurrentTimestamp()) {
        throw new utils.HTTPError(400);
    }

    db.run("UPDATE user SET password_hash = ? WHERE id = ?", password_hash, session.user_id);

    db.run("DELETE FROM session WHERE token = ?", token);

    res.sendStatus(200);
}

async function create_session(user_id: string, expiration_time: number): Promise<string> {
    assert.strictEqual(typeof user_id, "string");
    assert.strictEqual(typeof expiration_time, "number");

    const session_token = utils.generateToken();
    db.run("INSERT INTO session (user_id, token, expires) VALUES (?, ?, ?)", user_id, session_token, getCurrentTimestamp() + expiration_time);
    return session_token;
}

export function get_users() {
    return db.all<User>("SELECT * FROM user");
}

export function clear_expired_sessions() {
    db.run("DELETE FROM session WHERE expires < ?", getCurrentTimestamp());
}

function validate_password(password: string) {
    if (password.length < 10) {
        throw new utils.HTTPError(400, "Password too short");
    }
}
