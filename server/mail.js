import fs from "fs";
import nodemailer from "nodemailer";
import * as utils from "./utils.js";
import * as logger from "./logger.js"

export class EMailTransporter {
    #transporter;
    #from;

    /**
     * Creates an EMailTransporter
     * @param {string} name - The name in the config file
     */
    constructor(name) {
        const config = utils.config.email[name];
        if (!config) {
            logger.error(`Invalid email name "${name}"`);
            throw new Error(`Invalid email name "${name}`);
        }

        const password = (() => {
            if (config.password) {
                return config.password;
            }

            if (config.password_file) {
                return fs.readFileSync(config.password_file, "utf8").replace(/\n/g, "");
            }

            return undefined;
        })();

        this.#from = config.from;
        this.#transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: password,
            },
        });

        this.#transporter.verify((error, _success) => {
            if (error) {
                logger.error(`For email name "${name}": ${error.toString()}`);
            } else {
                logger.info(`email "${name}" SMTP connection working.`);
            }
        });
    }

    /**
     * Sends an email
     * @param {Object} options
     * @param {string} options.to - The recipient of the email
     * @param {string|undefined} options.replyTo - The reply address
     * @param {string} options.subject - The subject of the email
     * @param {string|undefined} options.text - Plain text content
     * @param {string|undefined} options.html - HTML content
     * @returns {Promise<string>} Response string of the SMTP server
     */
    send(options) {
        return new Promise((resolve, reject) => {
            this.#transporter.sendMail({
                from: this.#from,
                to: options.to,
                replyTo: options.replyTo,
                subject: options.subject,
                text: options.text,
                html: options.html,
            }, (err, info) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(info.response);
                    }
                });
        })
    }
};
