import * as logger from "./logger.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

interface Config {
    base_url: string,
    address: string,
    port: number,
    data_directory: string,
    cf_turnstile_secret?: string,
    cf_turnstile_secret_file?: string,
    email: {
        auth: {
            host: string,
            port: number,
            secure: boolean,
            user: string,
            password?: string,
            password_file?: string,
            from: string,
        },
        itf: {
            host: string,
            port: number,
            secure: boolean,
            user: string,
            password?: string,
            password_file?: string,
            from: string,
        },
        improglycerin: {
            host: string,
            port: number,
            secure: boolean,
            user: string,
            password?: string,
            password_file?: string,
            from: string,
        }
    }
}

export const project_path = path.dirname(path.join(fileURLToPath(import.meta.url), ".."));
const config_text = fs.readFileSync(process.env.ITF_CONFIG_FILE || path.join(project_path, "config.json"), "utf8");
export const config: Config = JSON.parse(config_text);

/**
 * Generates random string
 */
export function generateToken(length: number): string {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    let text = "";
    for (let i = 0; i < length; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function statusMessage(status: number) {
    switch (status) {
        case 400: return "Bad Request";
        case 401: return "Unauthorized";
        case 403: return "Forbidden";
        case 404: return "Not Found";
        case 409: return "Conflict";
        case 413: return "Payload Too Large";
    };
    logger.warn(`Missing default status message for code '${status}'`);
    return "";
}

export class HTTPError extends Error {
    status: number;

    constructor(status: number, message?: string) {
        super(message || statusMessage(status));
        this.name = "HTTPError";
        this.status = status;
    }
}
