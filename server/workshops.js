const db = require("./db");
const utils = require("./utils");

const timeDateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
const dateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const timeFormat = Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });
const isoFormat = Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });

exports.post = async (req, res) => {
    if (!req.user) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    let id = await exports.createWorkshop(req.body.begin, req.body.end, req.body.title, req.body.content, req.body.img, req.body.color, req.body.visible, req.body.location, req.body.price, req.body.email);
    res.status(200);
    res.json({ status: 200, data: { id } });
}

exports.put = async (req, res) => {
    if (!req.user || !req.body.id) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    await exports.editWorkshop(req.body.id, req.body.begin, req.body.end, req.body.title, req.body.content, req.body.img, req.body.color, req.body.visible, req.body.location, req.body.price, req.body.email);
    res.status(200);
    res.json({ status: 200 });
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

exports.getWorkshops = async (loggedIn) => {
    let workshops;
    if (loggedIn)
        workshops = await db.all(`SELECT * FROM workshop ORDER BY begin DESC`) || [];
    else
        workshops = await db.all(`SELECT * FROM workshop WHERE visible = 1 ORDER BY begin DESC`) || [];
    for (let workshop of workshops) {
        workshop.timeText = timeDateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
    }
    return workshops;
}

exports.getWorkshop = async (id, loggedIn) => {
    let workshop;
    if (loggedIn) {
        workshop = await db.get(`SELECT * FROM workshop WHERE created = '${id}'`);
        if (!workshop) return undefined;
        let beginISO = isoFormat.format(workshop.begin * 1000);
        let endISO = isoFormat.format(workshop.end * 1000);
        workshop.dateISO = beginISO.substr(0, 10);
        workshop.beginTimeISO = beginISO.substr(11, 5);
        workshop.endTimeISO = endISO.substr(11, 5);
    } else {
        workshop = await db.get(`SELECT * FROM workshop WHERE created = '${id}' AND visible = 1`);
        if (!workshop) return undefined;
    }
    workshop.dateText = dateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
    workshop.timeText = timeFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
    return workshop;
}

exports.createWorkshop = async (begin, end, title, content, img, color, visible, location, price, email) => {
    let created = utils.getCurrentTimestamp();
    if (!begin) begin = created;
    if (!end) end = created + 7200;
    if (!title) title = "Name des Workshops";
    if (!content) content = "Eine Beschreibung des Workshops";
    if (!color) color = "#FFFFFF";
    if (!visible) visible = 0;
    if (!location) location = "Ort";
    if (!price) price = "Preis";
    if (!email) email = "hallo@improglycerin.de";
    await db.run(`INSERT INTO workshop (created, begin, end, title, content, img, color, visible, location, price, email) VALUES ('${created}', '${begin}', '${end}', '${title}', '${content}', '${img}', '${color}', '${visible}', '${location}', '${price}', '${email}')`);
    return created;
}

exports.editWorkshop = async (id, begin, end, title, content, img, color, visible, location, price, email) => {
    let set = "";
    if (begin) set += `begin = '${begin}', `;
    if (end) set += `end = '${end}', `;
    if (title) set += `title = '${title}', `;
    if (content) set += `content = '${content}', `;
    if (img) set += `img = '${img}', `;
    if (color) set += `color = '${color}', `;
    if (visible !== undefined) set += `visible = '${visible ? 1 : 0}', `;
    if (location) set += `location = '${location}', `;
    if (price) set += `price = '${price}', `;
    if (email) set += `email = '${email}', `;
    if (set === "") {
        res.status(400);
        res.json({ status: 400 });
        return;
    }
    set = set.substring(0, set.length - 2);
    await db.run(`UPDATE workshop SET ${set} WHERE created = '${id}'`);
}

exports.deleteWorkshop = async (id) => {
    await db.run(`DELETE FROM workshop WHERE created = '${id}'`);
}
