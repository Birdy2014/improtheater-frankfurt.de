const express = require("express");
const fs = require("fs");
const path = require("path");
const auth = require("./auth");

const router = express.Router();

// Get all routes
let routes = [];
let content = fs.readdirSync(path.join(__dirname, "/../client/views/routes"));
for (let route of content) {
    if (route.endsWith(".html"))
        routes.push(route.substring(0, route.lastIndexOf(".")));
}

// Backend
router.get("/api/authhook", auth.authhook);
router.post("/api/logout", auth.logout);

// Libraries
router.get("/lib/nprogress.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.css")));
router.get("/lib/axios.min.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/axios/dist/axios.min.js")));
router.use("/public", express.static(path.join(__dirname, "/../client/public")));

// Frontend
router.get("/", (req, res) => {
    res.redirect("/start");
});

// Workaround for apache
router.get("/index.html", (req, res) => {
    res.redirect("/start");
});

router.get("/:route", auth.getUser, (req, res) => {
    if (!routes.includes(req.params.route)) {
        res.render("404");
    } else {
        if (req.query.partial) {
            res.render("routes/" + req.params.route);
        } else {
            res.render("template.html", {
                locals: {
                    route: req.params.route,
                    script: req.user !== undefined ? "<script>loggedIn()</script>" : ""
                },
                partials: {
                    nav: "nav",
                    footer: "footer"
                }
            });
        }
    }
});

module.exports = router;
