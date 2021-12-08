const Database = require("better-sqlite3");

exports.init = () => {
    exports.db = new Database(__dirname + "/../improtheater-frankfurt.db");

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
            propertiesHidden INTEGER DEFAULT 0,
            newsletterSent INTEGER DEFAULT 0,
            facebookEventCreated INTEGER DEFAULT 0,
            type INTEGER NOT NULL,
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
            subscribedTo INTEGER NOT NULL,
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

exports.run = (sql, ...params) => {
    let statement = exports.db.prepare(sql);
    statement.run(...params);
}

exports.get = (sql, ...params) => {
    let statement = exports.db.prepare(sql);
    return statement.get(params);
}

exports.all = (sql, ...params) => {
    let statement = exports.db.prepare(sql);
    return statement.all(...params);
}
