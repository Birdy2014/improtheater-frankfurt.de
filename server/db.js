const sqlite3 = require("sqlite3");
const { promisify } = require("util");

exports.init = async () => {
    exports.db = new sqlite3.Database(__dirname + "/../improtheater-frankfurt.db");
    exports.run = promisify(exports.db.run).bind(exports.db);
    exports.get = promisify(exports.db.get).bind(exports.db);
    exports.all = promisify(exports.db.all).bind(exports.db);

    exports.run(`
        CREATE TABLE IF NOT EXISTS workshop (
            created INTEGER NOT NULL,
            begin INTEGER NOT NULL,
            end INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            img TEXT NOT NULL,
            color TEXT NOT NULL,
            visible INTEGER DEFAULT 0,
            PRIMARY KEY (created)
        )
    `);

    exports.run(`
        CREATE TABLE IF NOT EXISTS subscriber (
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            token TEXT,
            timestamp INTEGER NOT NULL,
            confirmed INTEGER DEFAULT 0,
            PRIMARY KEY(email)
        )
    `);
}
