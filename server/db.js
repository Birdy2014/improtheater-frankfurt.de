const sqlite3 = require("sqlite3");
const { promisify } = require("util");

exports.init = async () => {
    exports.db = new sqlite3.Database(__dirname + "/../improtheater-frankfurt.db");
    exports.run = promisify(exports.db.run).bind(exports.db);
    exports.get = promisify(exports.db.get).bind(exports.db);
    exports.all = promisify(exports.db.all).bind(exports.db);

    exports.run(`
        CREATE TABLE IF NOT EXISTS workshop (
            id INTEGER NOT NULL,
            begin INTEGER NOT NULL,
            end INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            img TEXT NOT NULL,
            color TEXT NOT NULL,
            visible INTEGER DEFAULT 0,
            location TEXT NOT NULL,
            price TEXT NOT NULL,
            email TEXT NOT NULL,
            newsletterSent INTEGER DEFAULT 0,
            facebookEventCreated INTEGER DEFAULT 0,
            PRIMARY KEY (id)
        )
    `);

    exports.run(`
        CREATE TABLE IF NOT EXISTS subscriber (
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            token TEXT,
            timestamp INTEGER NOT NULL,
            confirmed INTEGER DEFAULT 0,
            last_viewed_newsletter INTEGER DEFAULT 0,
            PRIMARY KEY(email)
        )
    `);

    exports.run(`
        CREATE TABLE IF NOT EXISTS upload (
            name TEXT NOT NULL,
            mimetype TEXT NOT NULL,
            size INTEGER NOT NULL,
            data BLOB NOT NULL,
            user_id TEXT NOT NULL,
            time INTEGER NOT NULL,
            PRIMARY KEY(name)
        )
    `);

    exports.run(`
        CREATE TABLE IF NOT EXISTS editableWebsite (
            name TEXT NOT NULL,
            content TEXT,
            PRIMARY KEY(name)
        )
    `);
}
