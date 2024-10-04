import express from "express";
import cookieParser from "cookie-parser";
import { marked } from "marked";
import router from "./server/routes.js";
import * as utils from "./server/utils.js";
import * as logger from "./server/logger.js";
import { clear_expired_sessions } from "./server/auth.js";

logger.init(utils.config.logpath);

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
    logger.error(err.stack);
    res.status(500);

    if (req.accepts("json", "html") == "html") {
        res.render("error", { status: 500, message: "Internal Server Error" });
    } else {
        res.json({ status: 500, data: { message: err.message } });
    }
});

app.listen(utils.config.port || 8080);
