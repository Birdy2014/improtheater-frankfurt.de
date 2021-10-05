const db = require("./db");
const utils = require("./utils");
const logger = require("./logger");

const timeDateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
const dateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const timeFormat = Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });
const isoFormat = Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });

exports.defaultTitle = "Name des Workshops";
exports.defaultContent = "Eine Beschreibung des Workshops";

exports.post = async (req, res) => {
    if (!req.user) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    let id = await exports.editWorkshop(req.body);
    res.status(200);
    res.json({ status: 200, data: { id } });
}

exports.delete = async (req, res) => {
    if (!req.user || !req.body.id) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    await exports.deleteWorkshop(req.body.id);
    res.status(200);
    res.json({ status: 200 });
}

exports.getWorkshops = async (loggedIn, page, type) => {
    const perPage = 6;
    page = parseInt(page);
    if (!page)
        page = 0;
    let workshops;
    if (loggedIn)
        workshops = await db.all(`SELECT * FROM workshop WHERE type = ? ORDER BY begin DESC LIMIT ?, ?`, type, perPage * page, perPage) || [];
    else
        workshops = await db.all(`SELECT * FROM workshop WHERE type = ? AND visible = 1 ORDER BY begin DESC LIMIT ?, ?`, type, perPage * page, perPage) || [];
    for (let workshop of workshops) {
        try {
            workshop.timeText = timeDateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
            workshop.outdated = workshop.end < utils.getCurrentTimestamp();
        } catch (e) {
            workshop.timeText = "Error: Invalid Time";
            workshop.outdated = workshop.end < utils.getCurrentTimestamp();
        }
        if (!workshop.img.includes("/"))
            workshop.img = utils.base_url + "/api/upload?name=" + workshop.img;
    }
    return workshops;
}

exports.getWorkshop = async (id, loggedIn) => {
    let workshop;
    if (loggedIn) {
        workshop = await db.get(`SELECT * FROM workshop WHERE id = '${id}'`);
        if (!workshop) return undefined;
        try {
            let beginISO = isoFormat.format(workshop.begin * 1000);
            let endISO = isoFormat.format(workshop.end * 1000);
            workshop.dateISO = beginISO.substr(0, 10);
            workshop.beginTimeISO = beginISO.substr(11, 5);
            workshop.endTimeISO = endISO.substr(11, 5);
        } catch (e) {
            logger.warn(JSON.stringify(e));
            workshop.beginTimeISO = "";
            workshop.endTimeISO = "";
        }
    } else {
        workshop = await db.get(`SELECT * FROM workshop WHERE id = '${id}' AND visible = 1`);
        if (!workshop) return undefined;
    }
    try {
        workshop.dateText = dateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
        workshop.timeText = timeFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
    } catch (e) {
        workshop.dateText = "Error: Invalid Time";
        workshop.timeText = "Error: Invalid Time";
    }
    if (!workshop.img.includes("/"))
        workshop.img = utils.base_url + "/api/upload?name=" + workshop.img;
    workshop.propertiesHidden = workshop.propertiesHidden === 1;
    return workshop;
}

exports.editWorkshop = async (workshop) => {
    const timestamp = utils.getCurrentTimestamp();
    const defaultWorkshop = {
        id: timestamp,
        begin: timestamp,
        end: timestamp,
        title: exports.defaultTitle,
        content: exports.defaultContent,
        color: "#e65656",
        visible: 0,
        location: "Ort",
        price: "Preis",
        email: "[YesTicket](https://www.yesticket.org/events/de/improglycerin/)",
        img: "/public/img/workshop-default.png",
        propertiesHidden: 0,
        type: 1
    };
    const id = workshop.id || defaultWorkshop.id;

    let params = {};

    // Create params
    for (let key in defaultWorkshop) {
        params['$' + key] = workshop[key] || defaultWorkshop[key];
    }

    // Create update string
    let update = "";
    for (let key in defaultWorkshop) {
        if (workshop[key] !== undefined) {
            if (typeof workshop[key] === "boolean") workshop[key] = workshop[key] ? 1 : 0;
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
        await db.run(`INSERT INTO workshop ${insert} ON CONFLICT(id) DO UPDATE SET ${update} WHERE id = '${id}'`, params);
    else
        await db.run(`INSERT INTO workshop ${insert} ON CONFLICT(id) DO NOTHING`, params);

    return id;
}

exports.deleteWorkshop = async (id) => {
    await db.run(`DELETE FROM workshop WHERE id = '${id}'`);
}
