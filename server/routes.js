const express = require("express");
const fs = require("fs");
const path = require("path");
const auth = require("./auth");
const workshops = require("./workshops");

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
router.post("/api/workshops", auth.getUser, workshops.post);

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

router.get("/workshop/:workshopID", auth.getUser, async (req, res) => {
    let w = await workshops.getWorkshop(req.params.workshopID);
    if (!w) {
        res.render("404");
    } else {
        if (req.query.partial) {
            res.render("routes/workshop", { locals: w });
        } else {
            res.render("template", {
                locals: {
                    route: "workshop/" + req.params.workshopID,
                    loggedIn: req.user !== undefined
                },
                partials: {
                    nav: "nav",
                    footer: "footer"
                }
            });
        }
    }
});

router.get("/:route", auth.getUser, async (req, res) => {
    if (!routes.includes(req.params.route)) {
        res.render("404");
    } else {
        if (req.query.partial) {
            res.render("routes/" + req.params.route, await getRenderOptions(req.params.route));
        } else {
            res.render("template.html", {
                locals: {
                    route: req.params.route,
                    loggedIn: req.user !== undefined
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

async function getRenderOptions(route) {
    switch(route) {
        case "workshops":
            return { locals: { workshops: await workshops.getWorkshops() } }
        default:
            return {};
    }
}
