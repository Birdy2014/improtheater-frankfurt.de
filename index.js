import express from "express";
import cookieParser from "cookie-parser";
import { marked } from "marked";
import router from "./server/routes.js";
import * as db from "./server/db.js";
import * as utils from "./server/utils.js";
import * as logger from "./server/logger.js";

logger.init(utils.config.logpath || utils.project_path + "/logs");
db.init();

marked.setOptions({
    gfm: true,
    breaks: true,
    smartypants: true,
});

const app = express();

app.set("views", utils.project_path + "/client/views");
app.set("view engine", "pug");
app.use(express.json());
app.use(cookieParser());

app.use(router);

// Log errors
app.use((err, req, res, next) => {
    logger.warn(JSON.stringify(err.stack));
    res.status(500);
    res.json({ status: 500, data: { message: err.message } });
});

app.listen(utils.config.port || 8080);
