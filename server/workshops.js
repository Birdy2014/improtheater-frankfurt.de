const db = require("./db");
const utils = require("./utils");

exports.post = async (req, res) => {
    if (!req.user || !req.body.title) {
        res.status(400);
        res.json({ status: 400 });
    }

    await exports.createWorkshop(req.body.begin, req.body.end, req.body.title, req.body.content, req.body.img, req.body.color, req.body.visible);
    res.status(200);
    res.json({ status: 200 });
}

exports.put = async (req, res) => {
    if (!req.user || !req.body.id) {
        res.status(400);
        res.json({ status: 400 });
    }

    await exports.editWorkshop(req.body.id, req.body.begin, req.body.end, req.body.title, req.body.content, req.body.img, req.body.color, req.body.visible);
    res.status(200);
    res.json({ status: 200 });
}

exports.delete = async (req, res) => {
    if (!req.user || !req.body.id) {
        res.status(400);
        res.json({ status: 400 });
    }

    await exports.deleteWorkshop(req.body.id);
    res.status(200);
    res.json({ status: 200 });
}

exports.getWorkshops = async () => {
    return await db.all(`SELECT * FROM workshop`) || [];
}

exports.getWorkshop = async (id) => {
    return await db.get(`SELECT * FROM workshop WHERE created = '${id}'`);
}

exports.createWorkshop = async (begin, end, title, content, img, color, visible) => {
    await db.exec(`INSERT INTO workshop (created, begin, end, title, content, img, color, visible) VALUES ('${utils.getCurrentTimestamp()}', '${begin}', '${end}', '${title}', '${content}', '${img}', '${color}', '${visible}')`);
}

exports.editWorkshop = async (id, begin, end, title, content, img, color, visible) => {
    let set = "";
    if (begin) set += `begin = '${begin}', `;
    if (end) set += `end = '${end}', `;
    if (title) set += `title = '${title}', `;
    if (content) set += `content = '${content}', `;
    if (img) set += `img = '${img}', `;
    if (color) set += `color = '${color}', `;
    set += `visible = '${visible ? 1 : 0}' `;
    await db.exec(`UPDATE workshop SET ${set} WHERE created = '${id}'`);
}

exports.deleteWorkshop = async (id) => {
    await db.exec(`DELETE FROM workshop WHERE created = '${id}'`);
}
