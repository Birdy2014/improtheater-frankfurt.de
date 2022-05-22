import * as db from "./db.js";

export function getEditableWebsite(name) {
    try {
        return db.get("SELECT content FROM editableWebsite WHERE name = ?", name).content;
    } catch(e) {
        return "";
    }
}

export function setEditableWebsite(name, content) {
    db.run("INSERT INTO editableWebsite (name, content) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET content = ?", name, content, content);
}

export function setEditableWebsiteMiddleware(name) {
    return (req, res) => {
        if (!req.user || !req.body.content)
            return res.sendStatus(400);

        try {
            setEditableWebsite(name, req.body.content);
            res.sendStatus(200);
        } catch(e) {
            console.log(e);
            res.sendStatus(500);
        }
    }
}
