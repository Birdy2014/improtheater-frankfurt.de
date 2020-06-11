const express = require("express");
const es6Renderer = require("express-es6-template-engine");
const router = require("./server/routes");
const db = require("./server/db");

db.init();

const app = express();

app.engine("html", es6Renderer);
app.set("views", "client/views");
app.set("view engine", "html");
app.use(express.json());

app.use(router);

app.listen(8080);
