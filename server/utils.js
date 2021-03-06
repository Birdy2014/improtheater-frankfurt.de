const config = require("../config");

exports.getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000);
}

/**
 * Generates random string
 * @param {number} length
 * @returns {string}
 */
exports.generateToken = (length) => {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    let text = "";
    for (let i = 0; i < length; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}

exports.sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.base_url = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
