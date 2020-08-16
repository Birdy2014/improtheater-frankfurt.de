const express = require("express");
const fs = require("fs");
const path = require("path");
const fileUpload = require("express-fileupload");
const auth = require("./auth");
const workshops = require("./workshops");
const newsletter = require("./newsletter");
const upload = require("./upload");

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
router.get("/api/login", auth.getUser, (req, res) => res.redirect(req.cookies.route || "/"));
router.post("/api/logout", auth.logout);
router.post("/api/workshops", auth.getUser, workshops.post);
router.put("/api/workshops", auth.getUser, workshops.put);
router.delete("/api/workshops", auth.getUser, workshops.delete);
router.post("/api/newsletter/subscribe", newsletter.subscribe);
router.get("/api/newsletter/confirm", newsletter.confirm);
router.get("/api/newsletter/unsubscribe", newsletter.unsubscribe);
router.post("/api/newsletter/send", newsletter.send);
router.get("/api/upload", upload.get);
router.post("/api/upload", auth.getUser, fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }), upload.post);
router.delete("/api/upload", auth.getUser, upload.delete);

// Libraries
router.get("/lib/nprogress.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.css")));
router.get("/lib/axios.min.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/axios/dist/axios.min.js")));
router.use("/public", express.static(path.join(__dirname, "/../client/public")));

// Frontend
router.get("/", (req, res) => {
    res.redirect("/start")
});

// Workaround for apache
router.get("/index.html", (req, res) => {
    res.redirect("/start");
});

router.get("/workshop/:workshopID", auth.getUser, async (req, res) => {
    let w = await workshops.getWorkshop(req.params.workshopID, req.user !== undefined);
    if (!w) {
        res.status(404);
        res.render("404");
    } else {
        if (req.query.partial) {
            res.render("routes/workshop", { locals: { ...w, loggedIn: req.user !== undefined }});
        } else {
            res.render("template", {
                locals: {
                    route: "workshop/" + req.params.workshopID,
                    ...w,
                    loggedIn: req.user !== undefined
                },
                partials: {
                    nav: "nav",
                    footer: "footer",
                    routeContent: "routes/workshop"
                }
            });
        }
    }
});

router.get("/:route", auth.getUser, async (req, res) => {
    if (!routes.includes(req.params.route)) {
        res.status(404);
        res.render("404");
    } else {
        if (req.query.partial) {
            res.render("routes/" + req.params.route, await getRenderOptions(req.params.route, req.user !== undefined, req.query));
        } else {
            res.render("template.html", {
                locals: {
                    route: req.params.route,
                    ...(await getRenderOptions(req.params.route, req.user !== undefined, req.query)).locals
                },
                partials: {
                    nav: "nav",
                    footer: "footer",
                    routeContent: "routes/" + req.params.route
                }
            });
        }
    }
});

module.exports = router;

async function getRenderOptions(route, loggedIn, query) {
    switch(route) {
        case "workshops":
            return { locals: { loggedIn, workshops: await workshops.getWorkshops(loggedIn) } }
        case "newsletter":
            return { locals: { loggedIn, subscriber: await newsletter.getSubscriber(query.token), subscribers: await newsletter.getSubscribers(), unsubscribed: query.unsubscribed } };
        default:
            return { locals: { loggedIn } };
    }
}
