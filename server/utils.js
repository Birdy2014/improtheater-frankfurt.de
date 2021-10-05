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

exports.wrapRoute = (route) => {
    return async (req, res, next) => {
        try {
            await route(req, res, next);
        } catch(err) {
            next(err);
        }
    }
}

exports.routeITF = (req, res, next) => {
    if (req.website === "itf")
        next();
    else
        next("route");
}

exports.routeImproglycerin = (req, res, next) => {
    if (req.website === "improglycerin")
        next();
    else
        next("route");
}

exports.base_url = (website) => {
    switch (website) {
        case "improglycerin":
            return process.env.TEST ? `http://improglycerin.localhost:${config.port}` : "https://improglycerin.de";
        default:
            return process.env.TEST ? `http://improtheater-frankfurt.localhost:${config.port}` : "https://improtheater-frankfurt.de";
    }
}
