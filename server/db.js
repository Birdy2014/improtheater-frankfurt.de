const sqlite3 = require("sqlite3");
const { promisify } = require("util");

exports.init = async () => {
    exports.db = new sqlite3.Database(__dirname + "/../improtheater-frankfurt.db");
    exports.query = promisify(exports.db.get).bind(exports.db);
}
