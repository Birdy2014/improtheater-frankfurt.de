const db = require("./db");
const utils = require("./utils");

exports.post = async (req, res) => {
    if (!req.user) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    let id = await exports.createWorkshop(req.body.begin, req.body.end, req.body.title, req.body.content, req.body.img, req.body.color, req.body.visible);
    res.status(200);
    res.json({ status: 200, data: { id } });
}

exports.put = async (req, res) => {
    if (!req.user || !req.body.id) {
        res.status(400);
        res.json({ status: 400 });
        return;
    }

    await exports.editWorkshop(req.body.id, req.body.begin, req.body.end, req.body.title, req.body.content, req.body.img, req.body.color, req.body.visible);
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

exports.getWorkshops = async () => {
    return await db.all(`SELECT * FROM workshop ORDER BY begin DESC`) || [];
}

exports.getWorkshop = async (id) => {
    return await db.get(`SELECT * FROM workshop WHERE created = '${id}'`);
}

exports.createWorkshop = async (begin, end, title, content, img, color, visible) => {
    let created = utils.getCurrentTimestamp();
    if (!begin) begin = created;
    if (!end) end = created + 7200;
    if (!title) title = "Name des Workshops";
    if (!content) content = "Eine Beschreibung des Workshops";
    if (!color) color = "#FFFFFF";
    if (!visible) visible = 0;
    await db.exec(`INSERT INTO workshop (created, begin, end, title, content, img, color, visible) VALUES ('${created}', '${begin}', '${end}', '${title}', '${content}', '${img}', '${color}', '${visible}')`);
    return created;
}

exports.editWorkshop = async (id, begin, end, title, content, img, color, visible) => {
    let set = "";
    if (begin) set += `begin = '${begin}', `;
    if (end) set += `end = '${end}', `;
    if (title) set += `title = '${title}', `;
    if (content) set += `content = '${content}', `;
    if (img) set += `img = '${img}', `;
    if (color) set += `color = '${color}', `;
    if (visible !== undefined) set += `visible = '${visible ? 1 : 0}', `;
    if (set === "") {
        res.status(400);
        res.json({ status: 400 });
        return;
    }
    set = set.substring(0, set.length - 2);
    await db.exec(`UPDATE workshop SET ${set} WHERE created = '${id}'`);
}

exports.deleteWorkshop = async (id) => {
    await db.exec(`DELETE FROM workshop WHERE created = '${id}'`);
}
