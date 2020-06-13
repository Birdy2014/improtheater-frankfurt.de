const sqlite3 = require("sqlite3");
const { promisify } = require("util");

exports.init = async () => {
    exports.db = new sqlite3.Database(__dirname + "/../improtheater-frankfurt.db");
    exports.query = promisify(exports.db.get).bind(exports.db);

    exports.query(`
        CREATE TABLE IF NOT EXISTS workshops (
            created INTEGER NOT NULL,
            date INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            img TEXT NOT NULL,
            PRIMARY KEY (date, title)
        )
    `);

    exports.query(`
        CREATE TABLE IF NOT EXISTS newsletter (
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            token TEXT,
            PRIMARY KEY(email)
        )
    `);
}
