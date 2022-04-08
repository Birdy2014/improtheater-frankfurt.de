const sharp = require("sharp");
const db = require("./db");
const utils = require("./utils");
const logger = require("./logger");

exports.get = (req, res) => {
    if (!req.query.name) {
        let files = db.all("SELECT name FROM upload ORDER BY time DESC");
        res.status(200);
        res.json(files);
        return;
    }

    if (req.query.token) {
        let workshop = db.get("SELECT id FROM workshop WHERE img = ? ORDER BY begin DESC", req.query.name);
        if (workshop)
            db.run("UPDATE subscriber SET last_viewed_newsletter = ? WHERE token = ? AND last_viewed_newsletter < ?", workshop.id, req.query.token, workshop.id);
    }

    let file = db.get("SELECT data, mimetype FROM upload WHERE name = ?", req.query.name);

    if (!file)
        return res.sendStatus(404);

    res.status(200);
    res.header(`Content-Type: ${file.mimetype}`);
    res.end(file.data, "binary");
}

exports.post = async (req, res) => {
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
        db.run("INSERT INTO upload (name, mimetype, size, data, user_id, time) VALUES (?, ?, ?, ?, ?, ?)", name, mimetype, size, resized_image, req.user.user_id, utils.getCurrentTimestamp());
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

exports.delete = (req, res) => {
    if (!req.query.name || !req.user) {
        res.sendStatus(400);
        return;
    }

    db.run("DELETE FROM upload WHERE name = ?", req.query.name);
    res.sendStatus(200);
}

exports.getAll = () => {
    return db.all("SELECT name FROM upload ORDER BY time DESC");
}
