import * as db from "./db.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import { invalidateUploadsCache } from "./upload.js";

const timeDateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
const dateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const timeFormat = Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });
const isoFormat = Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });

export const type_itf = 1;
export const type_improglycerin = 2;
export const type_both = 3;

export const defaultTitle = "Name des Workshops";
export const defaultContent = "Eine Beschreibung des Workshops";
export const copy_prefix = "[KOPIE] ";

export function api_get(req, res) {
    const limit = 10; // This is an arbitrary number

    const workshops = req.user === undefined
        ? db.all("SELECT id, title FROM workshop WHERE visible = 1 ORDER BY begin DESC LIMIT ?", limit) || []
        : db.all("SELECT id, title FROM workshop ORDER BY begin DESC LIMIT ?", limit) || [];
    res.json(workshops);
}

export function post(req, res) {
    if (!req.user) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    const workshop = req.body;

    if (db.get("select count(*) from upload where id = ?", workshop.img)["count(*)"] != 1) {
        res.status(400).send("Nicht gespeichert: Ungültiges Bild");
        return;
    }

    let error_message = undefined;
    if (workshop.visible === 1) {
        const current_workshop = getWorkshop(workshop.id, true);
        const new_workshop = Object.assign(current_workshop, workshop);
        error_message = not_ready_for_publishing_error(new_workshop);
        if (error_message) {
            workshop.visible = 0;
            error_message = "Nicht veröffentlicht: " + error_message;
        }
    }

    let id = editWorkshop(workshop);

    if (error_message) {
        res.status(400).send(error_message);
        return;
    }

    res.status(200);
    res.json({ status: 200, data: { id } });
}

export function del(req, res) {
    if (!req.user || !req.body.id) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    deleteWorkshop(req.body.id);
    res.status(200);
    res.json({ status: 200 });
}

export function copy(req, res) {
    if (!req.user || !req.body.id) {
        return res.sendStatus(400);
    }

    const workshop = getWorkshop(req.body.id, true);
    if (!workshop) {
        return res.sendStatus(404);
    }

    workshop.id = undefined;
    workshop.title = copy_prefix + workshop.title;
    workshop.visible = 0;

    const copy_id = editWorkshop(workshop);

    res.status(200).json({ id: copy_id });
}

/**
 * Returns a string with an error message if the workshop is not ready to be published.
 *
 * @param {Object} - workshop
 * @returns {String|undefined}
 */
export function not_ready_for_publishing_error(workshop) {
    if (workshop.title && workshop.title.startsWith(copy_prefix)) {
        return "Der Workshop ist eine Kopie.";
    }
    if (workshop.title === defaultTitle || workshop.content === defaultContent) {
        return "Der Workshop enthält Standartwerte.";
    }

    return undefined;
}

export function getWorkshops(loggedIn, page = 0, type = 3) {
    const perPage = 6;
    page = parseInt(page);
    let workshops;
    if (loggedIn)
        workshops = db.all("SELECT * FROM workshop WHERE type & ? ORDER BY begin DESC LIMIT ?, ?", type, perPage * page, perPage) || [];
    else
        workshops = db.all("SELECT * FROM workshop WHERE type & ? AND visible = 1 ORDER BY begin DESC LIMIT ?, ?", type, perPage * page, perPage) || [];
    for (let workshop of workshops) {
        try {
            workshop.timeText = timeDateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
            workshop.outdated = workshop.end < utils.getCurrentTimestamp();
        } catch (e) {
            workshop.timeText = "Error: Invalid Time";
            workshop.outdated = workshop.end < utils.getCurrentTimestamp();
        }
        workshop.img_url = `${utils.base_url}/api/upload/${workshop.img}`;
        workshop.textColor = calcTextColor(workshop.color);
    }
    invalidateUploadsCache();
    return workshops;
}

export function getWorkshop(id, loggedIn) {
    let workshop;
    if (loggedIn) {
        workshop = db.get("SELECT * FROM workshop WHERE id = ?", id);
        if (!workshop) return undefined;
        try {
            let beginISO = isoFormat.format(workshop.begin * 1000);
            let endISO = isoFormat.format(workshop.end * 1000);
            workshop.dateISO = beginISO.substring(0, 10);
            workshop.beginTimeISO = beginISO.substring(11, 16);
            workshop.endTimeISO = endISO.substring(11, 16);
        } catch (e) {
            logger.warn(JSON.stringify(e));
            workshop.beginTimeISO = "";
            workshop.endTimeISO = "";
        }
    } else {
        workshop = db.get("SELECT * FROM workshop WHERE id = ? AND visible = 1", id);
        if (!workshop) return undefined;
    }
    try {
        workshop.dateText = dateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
        workshop.timeText = timeFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
    } catch (e) {
        workshop.dateText = "Error: Invalid Time";
        workshop.timeText = "Error: Invalid Time";
    }
    workshop.img_url = `${utils.base_url}/api/upload/${workshop.img}`;
    workshop.propertiesHidden = workshop.propertiesHidden === 1;
    return workshop;
}

export function editWorkshop(workshop) {
    const timestamp = utils.getCurrentTimestamp();
    const defaultWorkshop = {
        id: timestamp,
        begin: timestamp,
        end: timestamp,
        title: defaultTitle,
        content: defaultContent,
        color: "#e65656",
        visible: 0,
        location: "Ort",
        price: "Preis",
        email: "[YesTicket](https://www.yesticket.org/events/de/improglycerin/)",
        img: "00000000-0000-0000-0000-000000000000",
        propertiesHidden: 0,
        type: 1
    };
    const id = workshop.id || defaultWorkshop.id;

    let params = {};

    // Create params
    for (let key in defaultWorkshop) {
        params[key] = workshop[key] || defaultWorkshop[key];
        if (typeof params[key] === "boolean") params[key] = params[key] ? 1 : 0;
    }

    // Create update string
    let update = "";
    for (let key in defaultWorkshop) {
        if (workshop[key] !== undefined) {
            update += `${key} = $${key}, `
        }
    }
    update = update.substring(0, update.length - 2);

    // Create insert string
    let insert = "(";
    for (let key in defaultWorkshop) {
        insert += `${key}, `;
    }
    insert = insert.substring(0, insert.length - 2) + `) VALUES (`;
    for (let key in defaultWorkshop) {
        insert += `$${key}, `;
    }
    insert = insert.substring(0, insert.length - 2) + `)`;

    // Run upsert query
    if (update.length > 0)
        db.run(`INSERT INTO workshop ${insert} ON CONFLICT(id) DO UPDATE SET ${update} WHERE id = '${id}'`, params);
    else
        db.run(`INSERT INTO workshop ${insert} ON CONFLICT(id) DO NOTHING`, params);

    invalidateUploadsCache();

    return id;
}

export function deleteWorkshop(id) {
    db.run("DELETE FROM workshop WHERE id = ?", id);
    invalidateUploadsCache();
}

// Duplicate code from client/public/js/workshop.js
function calcTextColor(backgroundColor) {
    const r = parseInt(backgroundColor.substr(1, 2), 16);
    const g = parseInt(backgroundColor.substr(3, 2), 16);
    const b = parseInt(backgroundColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.5)
        return "#000000";
    else
        return "#ffffff";
}
