const sqlite3 = require("sqlite3");
const { promisify } = require("util");

exports.init = async () => {
    exports.db = new sqlite3.Database(__dirname + "/../improtheater-frankfurt.db");
    exports.query = promisify(exports.db.get).bind(exports.db);

    try {
        await exports.query("SELECT * FROM Newsletter");
    } catch(e) {
        await exports.query(`
            CREATE TABLE IF NOT EXISTS Newsletter (
                token TEXT NOT NULL,
                email TEXT NOT NULL,
                name TEXT NOT NULL,
                PRIMARY KEY(token, email)
            )
        `);
    }
}
