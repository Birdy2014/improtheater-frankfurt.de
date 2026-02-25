import express from "express";
import cookieParser from "cookie-parser";
import router from "./routes.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import { clear_expired_sessions } from "./auth.js";
import * as newsletter from "./newsletter.js";

setInterval(clear_expired_sessions, 24 * 60 * 60 * 1000);
clear_expired_sessions();

newsletter.send_from_queue();
function exit_handler() {
    newsletter.store_mail_queue_to_file();
    process.exit();
}
process.on("SIGINT", exit_handler);
process.on("SIGTERM", exit_handler);
process.on("SIGINT", exit_handler);
newsletter.load_mail_queue_from_file();

const app = express();

app.set("views", utils.project_path + "/client/views");
app.set("view engine", "pug");
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", true);

app.use(router);

// Log errors
app.use((err, req, res, next) => {
    let status;
    let message;
    if (err instanceof utils.HTTPError) {
        status = err.status;
        message = err.message;
    } else {
        logger.error(err);
        status = 500;
        message = "Internal Server Error";
    }
    res.status(status);

    if (req.accepts("json", "html") == "html") {
        res.render("error", { status, message });
    } else {
        res.send(message);
    }
});

app.listen(utils.config.port, utils.config.address);
