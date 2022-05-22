import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

export const project_path = path.dirname(path.join(fileURLToPath(import.meta.url), ".."));
const config_text = fs.readFileSync(path.join(project_path, "config.json"));
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

export const base_url = process.env.NODE_ENV === 'development' ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
