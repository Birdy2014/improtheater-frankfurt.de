import sharp from "sharp";
import crypto from "crypto";
import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import db, { Upload } from "./db.js";
import * as utils from "./utils.js";
import { getCurrentTimestamp } from "../common/time";
import * as logger from "./logger.js";

interface UploadCacheItem {
    id: string;
    name: string;
}

type File = Pick<Upload, "id" | "name" | "data" | "mimetype">;

let uploads_cache: UploadCacheItem[] | undefined = undefined;

export function get(req: Request, res: Response) {
    const requested_id = (req.params.id || req.query.name) as string;

    if (!requested_id) {
        throw new utils.HTTPError(400);
    }

    const uuid_regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

    let file = uuid_regex.test(requested_id)
        ? db.get<File>("SELECT id, name, data, mimetype FROM upload WHERE id = ?", requested_id)
        : db.get<File>("SELECT upload.id, upload.name, upload.data, upload.mimetype FROM upload JOIN workshop ON upload.id = workshop.img WHERE workshop.id = ?", requested_id);

    if (!file) {
        // Compatibility for old newsletters using names to identify images
        file = db.get<File>("SELECT id, name, data, mimetype FROM upload WHERE name = ?", requested_id);
    }

    if (!file) {
        throw new utils.HTTPError(404);
    }

    res.status(200)
        .set("Content-Type", file.mimetype)
        .set("Content-Disposition", `inline; filename="${file.name}"`)
        .send(file.data);

    const token = req.query.token as string | undefined;
    if (token) {
        const workshop = db.get<{ id: number }>("SELECT id FROM workshop WHERE img = ? ORDER BY begin DESC", file.id);

        if (workshop) {
            db.run("UPDATE subscriber SET last_viewed_newsletter = ? WHERE token = ? AND last_viewed_newsletter < ?", workshop.id, token, workshop.id);
        }
    }
}

export async function get_color(req: Request, res: Response) {
    const id = req.params.id as string;

    if (!id) {
        throw new utils.HTTPError(400);
    }

    let file = db.get<Pick<Upload, "data">>("SELECT data FROM upload WHERE id = ?", id);

    if (!file) {
        throw new utils.HTTPError(404);
    }

    const { dominant } = await sharp(file.data).stats();
    const to_hex = (n: number) => ("00" + n.toString(16)).slice(-2);
    const hex = `#${to_hex(dominant.r)}${to_hex(dominant.g)}${to_hex(dominant.b)}`

    res.status(200).json(hex);
}

const file_extension_regex = RegExp("^(.*)\.([a-zA-Z]{3}|[a-zA-Z]{4})$");

export async function post(req: Request, res: Response) {
    if (!req.files || !req.files.img || !req.user) {
        throw new utils.HTTPError(400);
    }

    const img = req.files.img as UploadedFile;

    if (img.truncated) {
        throw new utils.HTTPError(413);
    }

    const resized_image = await sharp(img.data)
        .resize(900, 400, { fit: 'inside' })
        .jpeg({ quality: 90 })
        .toBuffer()

    const mimetype = "image/jpeg";
    const size = resized_image.length;
    const name = Buffer.from(img.name, "latin1").toString("utf-8").replace(file_extension_regex, "$1");
    const id = crypto.randomUUID();

    try {
        db.run("INSERT INTO upload (id, name, mimetype, size, data, user_id, time) VALUES (?, ?, ?, ?, ?, ?, ?)", id, name, mimetype, size, resized_image, req.user.id, getCurrentTimestamp());
        invalidateUploadsCache();
        res.status(200).json({ id, name });
    } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            throw new utils.HTTPError(409);
        }
        logger.error(`Upload error: id: '${id}', name: '${name}', mimetype: '${mimetype}', size: '${size}'`);
        throw e
    }
}

export function del(req: Request, res: Response) {
    const id = req.params.id;

    if (!id || !req.user) {
        throw new utils.HTTPError(400);
    }

    db.run("DELETE FROM upload WHERE id = ?", id);
    if (uploads_cache) {
        uploads_cache = uploads_cache.filter((upload) => upload.id !== id);
    }
    res.sendStatus(200);
}

export function getAll(): UploadCacheItem[] {
    if (!uploads_cache) {
        uploads_cache = db.all<UploadCacheItem>("select upload.id, upload.name from upload left outer join workshop on upload.id = workshop.img group by upload.id order by max(workshop.begin) desc nulls first;");
    }
    return uploads_cache;
}

export function invalidateUploadsCache() {
    uploads_cache = undefined;
}
