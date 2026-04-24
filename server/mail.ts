import fs from "fs";
import nodemailer from "nodemailer";
import * as utils from "./utils.js";
import * as logger from "./logger.js"

export interface EMailOptions {
    to: string;
    replyTo?: string;
    subject: string;
    text?: string;
    html?: string;
}

export class EMailTransporter {
    #transporter: nodemailer.Transporter;
    #from: string;
    #last_sent_time: number;

    constructor(name: "auth" | "itf" | "improglycerin") {
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

        this.#last_sent_time = 0;
    }

    send(options: EMailOptions): Promise<string> {
        if (process.env.NODE_ENV === "development" && !process.env.ITF_SEND_MAILS) {
            let current_time = Date.now()
            let time_difference = current_time - this.#last_sent_time;
            this.#last_sent_time = current_time;

            // Fake send
            return new Promise((resolve, reject) => {
                if (time_difference < 2_000) {
                    reject(new Error("Fake email failed to send because of rate limit (" + time_difference + "s)"));
                    return;
                }

                if (Math.random() < 0.05) {
                    reject(new Error("Fake email randomly failed to send"));
                    return;
                }

                resolve("Fake email sent");
            });
        }

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
