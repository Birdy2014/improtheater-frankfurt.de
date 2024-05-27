import sharp from "sharp";
import { v4 as uuid } from "uuid";
import * as db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";

let uploads_cache = undefined;

export function get(req, res) {
    const id = req.params.id || req.query.name;

    if (!id) {
        res.status(400);
        return;
    }

    const uuid_regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

    let file = uuid_regex.test(id)
        ? db.get("SELECT data, mimetype FROM upload WHERE id = ?", id)
        : db.get("SELECT upload.data, upload.mimetype FROM upload JOIN workshop ON upload.id = workshop.img WHERE workshop.id = ?", id);

    if (!file) {
        // Compatibility for old newsletters using names to identify images
        file = db.get("SELECT data, mimetype FROM upload WHERE name = ?", id);
    }

    if (!file)
        return res.sendStatus(404);

    res.status(200);
    res.set("Content-Type", file.mimetype);
    res.send(Buffer.from(file.data, "binary"));

    if (req.query.token) {
        let workshop = db.get("SELECT id FROM workshop WHERE img = ? ORDER BY begin DESC", id);
        if (!workshop) {
            workshop = db.get("SELECT id FROM workshop WHERE id = ? ORDER BY begin DESC", id);
        }
        if (workshop) {
            db.run("UPDATE subscriber SET last_viewed_newsletter = ? WHERE token = ? AND last_viewed_newsletter < ?", workshop.id, req.query.token, workshop.id);
        }
    }
}

export async function get_color(req, res) {
    const id = req.params.id;

    if (!id) {
        res.status(400);
        return;
    }

    let file = db.get("SELECT data FROM upload WHERE id = ?", id);

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
    const name = Buffer.from(req.files.img.name, "latin1").toString("utf-8");
    const id = uuid();

    try {
        db.run("INSERT INTO upload (id, name, mimetype, size, data, user_id, time) VALUES (?, ?, ?, ?, ?, ?, ?)", id, name, mimetype, size, resized_image, req.user.id, utils.getCurrentTimestamp());
        invalidateUploadsCache();
        res.status(200);
        res.json({ id, name });
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            res.sendStatus(409);
        } else {
            logger.error(`Upload error: id: '${id}', name: '${name}', mimetype: '${mimetype}', size: '${size}'\n${e.stack}`);
            res.sendStatus(500);
        }
    }
}

export function del(req, res) {
    const id = req.params.id;

    if (!id || !req.user) {
        res.sendStatus(400);
        return;
    }

    db.run("DELETE FROM upload WHERE id = ?", id);
    if (uploads_cache)
        uploads_cache = uploads_cache.filter(upload => upload.id !== id);
    res.sendStatus(200);
}

export function getAll() {
    if (!uploads_cache) {
        uploads_cache = db.all("select upload.id, upload.name from upload left outer join workshop on upload.id = workshop.img group by upload.id order by max(workshop.begin) desc nulls first;");
    }
    return uploads_cache;
}

export function invalidateUploadsCache() {
    uploads_cache = undefined;
}
