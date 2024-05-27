import fs from "fs";
import { promisify } from "util";

const appendFile = promisify(fs.appendFile);
export let log_file_path;

function datetime() {
    return new Date().toISOString().
        replace(/T/, ' ').
        replace(/\..+/, '')
}

export function init(path) {
    if (!path)
        return;

    if (path.charAt(path.length - 1) !== "/")
        path += "/";
    if (!fs.existsSync(path))
        fs.mkdirSync(path, { recursive: true });
    const date = new Date().toISOString().substring(0, 10);
    log_file_path = path + date + '.log';

    if (fs.existsSync(log_file_path)) {
        fs.appendFileSync(log_file_path, '\n');
    }

    fs.appendFileSync(log_file_path, `[${datetime()}] Start logging\n`);
}

export async function error(message) {
    log("ERROR", message)
}

export async function warn(message) {
    log("WARNING", message)
}

export async function info(message) {
    log("INFO", message)
}

async function log(prefix, message) {
    if (message instanceof Error)
        message = message.stack

    const final_message = `${prefix}: ${message}`;

    try {
        if (log_file_path)
            await appendFile(log_file_path, `[${datetime()}] ${final_message}\n`);
    } catch (e) {
        console.error("Cannot write to " + log_file_path);
    }
    console.log(final_message);
}
