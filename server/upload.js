import sharp from "sharp";
import * as db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";

let uploads_name_cache = []

export function get(req, res) {
    const name = req.params.name || req.query.name;

    if (!name) {
        res.status(400);
        return;
    }

    if (req.query.token) {
        let workshop = db.get("SELECT id FROM workshop WHERE img = ? ORDER BY begin DESC", name);
        if (workshop)
            db.run("UPDATE subscriber SET last_viewed_newsletter = ? WHERE token = ? AND last_viewed_newsletter < ?", workshop.id, req.query.token, workshop.id);
    }

    let file = db.get("SELECT data, mimetype FROM upload WHERE name = ?", name);

    if (!file)
        return res.sendStatus(404);

    res.status(200);
    res.set("Content-Type", file.mimetype);
    res.send(Buffer.from(file.data, "binary"));
}

export async function get_color(req, res) {
    const name = req.params.name;

    if (!name) {
        res.status(400);
        return;
    }

    let file = db.get("SELECT data FROM upload WHERE name = ?", name);

    if (!file) {
        res.status(404);
        return;
    }

    const { dominant } = await sharp(file.data).stats();
    const to_hex = number => ("00" + number.toString(16)).slice(-2);
    const hex = `#${to_hex(dominant.r)}${to_hex(dominant.g)}${to_hex(dominant.b)}`

    res.status(200);
    res.json(hex);
}

export async function post(req, res) {
    if (!req.files || !req.files.img || !req.user) {
        res.sendStatus(400);
        return;
    }

    if (req.files.img.truncated) {
        res.sendStatus(413);
        return;
    }

    const resized_image = await sharp(req.files.img.data)
        .resize(900, 400, { fit: 'inside' })
        .toBuffer()

    const mimetype = req.files.img.mimetype;
    const size = resized_image.length;
    const name = req.files.img.name;

    try {
        db.run("INSERT INTO upload (name, mimetype, size, data, user_id, time) VALUES (?, ?, ?, ?, ?, ?)", name, mimetype, size, resized_image, req.user.id, utils.getCurrentTimestamp());
        uploads_name_cache.unshift(name);
        res.status(200);
        res.json({ name });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            res.sendStatus(409);
        } else {
            logger.error(`Upload error: name: '${name}', mimetype: '${mimetype}', size: '${size}'` + JSON.stringify(e));
            res.sendStatus(500);
        }
    }
}

export function del(req, res) {
    const name = req.params.name || req.query.name;

    if (!name || !req.user) {
        res.sendStatus(400);
        return;
    }

    db.run("DELETE FROM upload WHERE name = ?", name);
    uploads_name_cache = uploads_name_cache.filter(n => n !== name);
    res.sendStatus(200);
}

export function getAll() {
    if (uploads_name_cache.length === 0)
        uploads_name_cache = db.all("SELECT name FROM upload ORDER BY time DESC").map(row => row.name);
    return uploads_name_cache;
}
