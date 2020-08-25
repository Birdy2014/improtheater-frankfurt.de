const express = require("express");
const cookieParser = require("cookie-parser");
const router = require("./server/routes");
const db = require("./server/db");
const config = require("./config");
const logger = require("./server/logger");

logger.init(config.logpath || __dirname + "/logs");
db.init();

const app = express();

app.set("views", __dirname + "/client/views");
app.set("view engine", "pug");
app.use(express.json());
app.use(cookieParser());

app.use(router);

// Log errors
app.use((err, req, res, next) => {
    logger.warn(JSON.stringify(err.stack));
    next(err);
});

app.listen(config.port || 8080);
