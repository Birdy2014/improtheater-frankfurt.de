import Database from "better-sqlite3";
import * as logger from "./logger.js";
import * as utils from "./utils.js";

export let db;

export function init() {
    db = new Database(utils.project_path + "/improtheater-frankfurt.db");

    run(`
        CREATE TABLE IF NOT EXISTS workshop (
            id INTEGER NOT NULL,
            begin INTEGER NOT NULL,
            end INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            img TEXT NOT NULL,
            color TEXT NOT NULL,
            visible INTEGER DEFAULT 0,
            location TEXT NOT NULL,
            price TEXT NOT NULL,
            email TEXT NOT NULL,
            propertiesHidden INTEGER DEFAULT 0,
            newsletterSent INTEGER DEFAULT 0,
            facebookEventCreated INTEGER DEFAULT 0,
            type INTEGER NOT NULL,
            PRIMARY KEY (id)
        )
    `);

    run(`
        CREATE TABLE IF NOT EXISTS subscriber (
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            token TEXT,
            timestamp INTEGER NOT NULL,
            confirmed INTEGER DEFAULT 0,
            last_viewed_newsletter INTEGER DEFAULT 0,
            subscribedTo INTEGER NOT NULL,
            PRIMARY KEY(email)
        )
    `);

    run(`
        CREATE TABLE IF NOT EXISTS upload (
            name TEXT NOT NULL,
            mimetype TEXT NOT NULL,
            size INTEGER NOT NULL,
            data BLOB NOT NULL,
            user_id TEXT NOT NULL,
            time INTEGER NOT NULL,
            PRIMARY KEY(name)
        )
    `);

    run(`
        CREATE TABLE IF NOT EXISTS editableWebsite (
            name TEXT NOT NULL,
            content TEXT,
            PRIMARY KEY(name)
        )
    `);

    run(`
        CREATE TABLE IF NOT EXISTS user (
            id TEXT NOT NULL,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            admin INTEGER NOT NULL,
            full_access INTEGER NOT NULL,
            PRIMARY KEY(id)
        )
    `)

    run(`
        CREATE TABLE IF NOT EXISTS session (
            user_id TEXT NOT NULL,
            token TEXT NOT NULL,
            expires INTEGER NOT NULL,
            PRIMARY KEY(token)
        )
    `)
}

export function run(sql, ...params) {
    const start_time = process.hrtime();

    const statement = db.prepare(sql);
    statement.run(...params);

    const duration = process.hrtime(start_time);
    if (duration[0] >= 1)
        logger.warn(`SQL run with query '${sql}' took ${duration[0]}s ${duration[1] / 1000000}ms`);
}

export function get(sql, ...params) {
    const start_time = process.hrtime();

    const statement = db.prepare(sql);
    const result = statement.get(params);

    const duration = process.hrtime(start_time);
    if (duration[0] >= 1)
        logger.warn(`SQL get with query '${sql}' took ${duration[0]}s ${duration[1] / 1000000}ms`);

    return result;
}

export function all(sql, ...params) {
    const start_time = process.hrtime();

    const statement = db.prepare(sql);
    const result = statement.all(...params);

    const duration = process.hrtime(start_time);
    if (duration[0] >= 1)
        logger.warn(`SQL all with query '${sql}' took ${duration[0]}s ${duration[1] / 1000000}ms`);

    return result;
}
