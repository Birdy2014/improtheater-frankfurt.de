import db, { Workshop } from "./db.js";
import { Request, Response } from "express";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import { invalidateUploadsCache } from "./upload.js";
import { calcTextColor } from "../common/color";
import { timeDateFormat, dateFormat, timeFormat, isoFormat, getCurrentTimestamp } from "../common/time";

export enum WorkshopType {
    Itf = 1,
    Improglycerin = 2,
    Both = 3,
}

export interface ExtendedWorkshop extends Omit<Workshop, "propertiesHidden" | "visible" | "newsletterSent"> {
    dateText: string,
    timeText: string,
    dateTimeText: string,
    dateISO: string,
    beginTimeISO: string,
    endTimeISO: string,
    img_url: string,
    textColorResolved: string,
    propertiesHidden: boolean,
    outdated: boolean,
    visible: boolean,
    newsletterSent: boolean,
}

export const defaultTitle = "Name des Workshops";
export const defaultContent = "Eine Beschreibung des Workshops";
export const copy_prefix = "[KOPIE] ";

export function api_get(req: Request, res: Response) {
    const limit = 20; // This is an arbitrary number

    const full = req.query.full !== undefined;
    const type = req.query.type !== undefined ? parseInt(req.query.type as string) : undefined;
    if (type !== undefined && typeof type !== "number") {
        throw new utils.HTTPError(400);
    }

    const conditions: string[] = [];

    if (req.user === undefined) {
        conditions.push("visible = 1");
    }
    if (type !== undefined) {
        conditions.push("type = @type");
    }

    const query = "select "
        + (full ? "*" : "id, title")
        + " from workshop "
        + (conditions.length > 0 ? "where " + conditions.join(" and ") : "")
        + " order by begin desc limit @limit";

    const workshops = db.all(query, { type: type, limit: limit }) || [];
    res.json(workshops);
}

export function post(req: Request, res: Response) {
    if (!req.user) {
        throw new utils.HTTPError(400);
    }

    const workshop = (req.body ?? {}) as Partial<Workshop>;

    if (workshop.img) {
        const imgCheck = db.get<{ "count(*)": number }>("select count(*) from upload where id = ?", workshop.img);
        if (!imgCheck || imgCheck["count(*)"] != 1) {
            throw new utils.HTTPError(400, "Nicht gespeichert: Ungültiges Bild");
        }
    }

    let error_message = undefined;
    if (workshop.visible === 1) {
        const current_workshop = getWorkshop(workshop.id as number, true);
        if (current_workshop) {
            const combinedWorkshop = { ...current_workshop, ...workshop };
            error_message = not_ready_for_publishing_error(combinedWorkshop);
            if (error_message) {
                workshop.visible = 0;
                error_message = "Nicht veröffentlicht: " + error_message;
            }
        }
    }

    let id = editWorkshop(workshop);

    if (error_message) {
        throw new utils.HTTPError(400, error_message);
    }

    res.status(200).json({ id });
}

export function del(req: Request, res: Response) {
    if (!req.user || !req.body.id) {
        throw new utils.HTTPError(400);
    }

    deleteWorkshop(req.body.id);
    res.sendStatus(200);
}

export function copy(req: Request, res: Response) {
    if (!req.user || !req.body.id) {
        throw new utils.HTTPError(400);
    }

    const rawWorkshop = db.get<Workshop>("SELECT * FROM workshop WHERE id = ?", req.body.id);
    if (!rawWorkshop) {
        throw new utils.HTTPError(404);
    }

    const timestamp = getCurrentTimestamp();
    const copyWorkshop: Partial<Workshop> = {
        ...rawWorkshop,
        id: undefined,
        title: copy_prefix + rawWorkshop.title,
        visible: 0,
        begin: timestamp,
        end: timestamp,
        newsletterSent: 0,
    };

    const copy_id = editWorkshop(copyWorkshop);

    res.status(200).json({ id: copy_id });
}

/**
 * Returns a string with an error message if the workshop is not ready to be published.
 */
export function not_ready_for_publishing_error(workshop: { title?: string; content?: string }) {
    if (workshop.title && workshop.title.startsWith(copy_prefix)) {
        return "Der Workshop ist eine Kopie.";
    }
    if (workshop.title === defaultTitle || workshop.content === defaultContent) {
        return "Der Workshop enthält Standardwerte.";
    }

    return undefined;
}

function extendWorkshop(workshop: Workshop) {
    let dateISO = "";
    let beginTimeISO = "";
    let endTimeISO = "";
    let dateText = "";
    let timeText = "";
    let dateTimeText = "";

    try {
        const beginISO = isoFormat.format(workshop.begin * 1000);
        const endISO = isoFormat.format(workshop.end * 1000);
        dateISO = beginISO.substring(0, 10);
        beginTimeISO = beginISO.substring(11, 16);
        endTimeISO = endISO.substring(11, 16);
        dateText = dateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
        timeText = timeFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
        dateTimeText = timeDateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
    } catch (e) {
        logger.warn(String(e));
        dateText = "Error: Invalid Time";
        timeText = "Error: Invalid Time";
    }

    return {
        ...workshop,
        propertiesHidden: workshop.propertiesHidden === 1,
        textColorResolved: workshop.textColor || calcTextColor(workshop.color),
        dateText,
        timeText,
        dateTimeText,
        dateISO,
        beginTimeISO,
        endTimeISO,
        img_url: `${utils.config.base_url}/api/upload/${workshop.img}`,
        outdated: workshop.end < getCurrentTimestamp(),
        visible: workshop.visible === 1,
        newsletterSent: workshop.newsletterSent === 1,
    };
}

export function getWorkshops(loggedIn: boolean, page: number | string = 0, type = 3): ExtendedWorkshop[] {
    const perPage = 6;
    const pageNum = typeof page === "string" ? parseInt(page) : page;
    const currentTime = getCurrentTimestamp();

    const workshops = db.all<Workshop>(
        "SELECT * FROM workshop WHERE type & $type AND ((NOT $publicOnly) OR visible = 1) ORDER BY begin DESC",
        { type, publicOnly: !loggedIn ? 1 : 0 }
    ) || [];

    const future = workshops.filter(w => w.end > currentTime);
    const past = workshops.filter(w => w.end <= currentTime);

    const extendedWorkshops: ExtendedWorkshop[] = [...future, ...past].slice(perPage * pageNum, perPage * pageNum + perPage).map(extendWorkshop);

    invalidateUploadsCache();
    return extendedWorkshops;
}

export function getWorkshop(id: number, loggedIn: boolean): ExtendedWorkshop | undefined {
    const workshop: Workshop | undefined = loggedIn
        ? db.get<Workshop>("SELECT * FROM workshop WHERE id = ?", id)
        : db.get<Workshop>("SELECT * FROM workshop WHERE id = ? AND visible = 1", id);

    if (!workshop) return undefined;

    return extendWorkshop(workshop);
}

export function editWorkshop(workshop: Partial<Workshop>) {
    const timestamp = getCurrentTimestamp();
    const defaultWorkshop: Workshop = {
        id: timestamp,
        begin: timestamp,
        end: timestamp,
        title: defaultTitle,
        content: defaultContent,
        color: "#e65656",
        textColor: "",
        visible: 0,
        location: "Ort",
        price: "Preis",
        email: "[YesTicket](https://www.yesticket.org/events/de/improglycerin/)",
        img: "00000000-0000-0000-0000-000000000000",
        propertiesHidden: 0,
        type: 1,
        newsletterSent: 0,
    };
    const id = workshop.id ?? defaultWorkshop.id;

    const keys = Object.keys(defaultWorkshop) as (keyof Workshop)[];

    const params: Record<string, unknown> = {};
    for (const key of keys) {
        params[key] = workshop[key] ?? defaultWorkshop[key];
        if (typeof params[key] === "boolean") params[key] = params[key] ? 1 : 0;
    }

    const update = keys.filter(key => workshop[key] !== undefined)
        .map(key => `${key} = $${key}`)
        .join(", ");

    const columns = keys.join(", ");
    const placeholders = keys.map(key => `$${key}`).join(", ");
    const insert = `(${columns}) VALUES (${placeholders})`;

    if (update.length > 0) {
        db.run(`INSERT INTO workshop ${insert} ON CONFLICT(id) DO UPDATE SET ${update} WHERE id = $id`, params);
    } else {
        db.run(`INSERT INTO workshop ${insert} ON CONFLICT(id) DO NOTHING`, params);
    }

    invalidateUploadsCache();

    return id;
}

export function deleteWorkshop(id: number) {
    db.run("DELETE FROM workshop WHERE id = ?", id);
    invalidateUploadsCache();
}
