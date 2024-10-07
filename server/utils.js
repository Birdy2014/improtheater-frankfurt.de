import * as logger from "./logger.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

export const project_path = path.dirname(path.join(fileURLToPath(import.meta.url), ".."));
const config_text = fs.readFileSync(process.env.ITF_CONFIG_FILE || path.join(project_path, "config.json"));
export const config = JSON.parse(config_text);

export function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Generates random string
 * @param {number} length
 * @returns {string}
 */
export function generateToken(length) {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    let text = "";
    for (let i = 0; i < length; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function wrapRoute(route) {
    return async (req, res, next) => {
        try {
            await route(req, res, next);
        } catch(err) {
            next(err);
        }
    }
}

function statusMessage(status) {
    switch (status) {
        case 400: return "Bad Request";
        case 401: return "Unauthorized";
        case 403: return "Forbidden";
        case 404: return "Not Found";
        case 409: return "Conflict";
        case 413: return "Payload Too Large";
    };
    logger.warn(`Missing default status message for code '{status}'`);
    return "";
}

export class HTTPError extends Error {
    status;

    constructor(status, message) {
        super(message || statusMessage(status));
        this.name = "HTTPError";
        this.status = status;
    }
}
