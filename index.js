import express from "express";
import cookieParser from "cookie-parser";
import { marked } from "marked";
import router from "./server/routes.js";
import * as utils from "./server/utils.js";
import * as logger from "./server/logger.js";
import { clear_expired_sessions } from "./server/auth.js";

marked.use({
    breaks: true,
});

setInterval(clear_expired_sessions, 24 * 60 * 60 * 1000);
clear_expired_sessions();

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

app.listen(utils.config.port || 8080);
