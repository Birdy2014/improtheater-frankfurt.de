const db = require("./db");

exports.getEditableWebsite = async name => {
    try {
        return (await db.get("SELECT content FROM editableWebsite WHERE name = ?", name)).content;
    } catch(e) {
        return "";
    }
}

exports.setEditableWebsite = async (name, content) => {
    await db.run("INSERT INTO editableWebsite (name, content) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET content = ?", name, content, content);
}

exports.setEditableWebsiteMiddleware = name => {
    return async (req, res) => {
        if (!req.user || !req.body.content)
            return res.sendStatus(400);

        try {
            await exports.setEditableWebsite(name, req.body.content);
            res.sendStatus(200);
        } catch(e) {
            console.log(e);
            res.sendStatus(500);
        }
    }
}
