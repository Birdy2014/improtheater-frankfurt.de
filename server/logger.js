import fs from "fs";
import { promisify } from "util";

const appendFile = promisify(fs.appendFile);
export let path;

export function init(path) {
    if (path.charAt(path.length - 1) !== "/")
        path += "/";
    if (!fs.existsSync(path))
        fs.mkdirSync(path, { recursive: true });
    let date = (new Date()).toISOString();
    date = date.replace(/ /g, "_");
    path = path + date;
    let nr = 0;
    for (; fs.existsSync(path + "_" + nr); nr++) { }
    path += "_" + nr;
}

export async function error(message) {
    let date = new Date().toISOString().
        replace(/T/, ' ').
        replace(/\..+/, '');

    try {
        await appendFile(path, `[${date}] ERROR: ${message}\n`);
    } catch (e) {
        console.error("Cannot write to " + path);
    }
    console.error(message);
}

export async function warn(message) {
    let date = new Date().toISOString().
        replace(/T/, ' ').
        replace(/\..+/, '');

    try {
        await appendFile(path, `[${date}] WARNING: ${message}\n`);
    } catch (e) {
        console.error("Cannot write to " + path);
    }
    console.log(message);
}

export async function info(message) {
    let date = new Date().toISOString().
        replace(/T/, ' ').
        replace(/\..+/, '')

    try {
        await appendFile(path, `[${date}] INFO: ${message}\n`);
    } catch (e) {
        console.error("Cannot write to " + path);
    }
    console.log(message);
}
