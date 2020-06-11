const express = require("express");
const fs = require("fs");
const path = require("path");
const newsletter = require("./newsletter");

const router = express.Router();

// Get all routes
let routes = [];
let content = fs.readdirSync(path.join(__dirname, "/../client/views/routes"));
for (let route of content) {
    if (route.endsWith(".html"))
        routes.push(route.substring(0, route.lastIndexOf(".")));
}

// Backend
router.post("/api/newsletter", newsletter.signup);
router.get("/api/newsletter", newsletter.verify);

// Libraries
router.get("/lib/nprogress.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.css")));
router.get("/lib/axios.min.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/axios/dist/axios.min.js")));
router.use("/public", express.static(path.join(__dirname, "/../client/public")));

// Frontend
router.get("/", (req, res) => {
    res.redirect("/start");
});

router.get("/:route", (req, res) => {
    if (!routes.includes(req.params.route)) {
        res.render("404.html");
    } else {
        if (req.query.partial) {
            res.render("routes/" + req.params.route);
        } else {
            res.render("template.html", {
                locals: {
                    route: req.params.route
                },
                partials: {
                    nav: "nav"
                }
            });
        }
    }
});

module.exports = router;
