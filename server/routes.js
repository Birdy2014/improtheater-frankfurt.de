const express = require("express");
const fs = require("fs");
const path = require("path");
const fileUpload = require("express-fileupload");
const marked = require("marked");
const auth = require("./auth");
const workshops = require("./workshops");
const newsletter = require("./newsletter");
const upload = require("./upload");
const editableWebsite = require("./editableWebsite");
const config = require("../config");
const { wrapRoute: route } = require("./utils");

const router = express.Router();

// Get all routes
let routes = [];
let content = fs.readdirSync(path.join(__dirname, "/../client/views/routes"));
for (let route of content) {
    if (route.endsWith(".pug"))
        routes.push(route.substring(0, route.lastIndexOf(".")));
}

// Redirect trailing slashes
router.use(function (req, res, next) {
    if (req.path.substr(-1) == '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

// Backend
router.get("/robots.txt", (req, res) => res.sendFile(path.join(__dirname, "/../client/robots.txt")));
router.get("/api/authhook", auth.authhook);
router.get("/api/login", auth.getUser, (req, res) => res.redirect(req.query.route || "/"));
router.post("/api/logout", route(auth.logout));
router.post("/api/workshops", auth.getUser, route(workshops.post));
router.delete("/api/workshops", auth.getUser, route(workshops.delete));
router.post("/api/newsletter/subscribe", route(newsletter.subscribe));
router.get("/api/newsletter/confirm", route(newsletter.confirm));
router.post("/api/newsletter/unsubscribe", route(newsletter.unsubscribe));
router.post("/api/newsletter/send", auth.getUser, route(newsletter.send));
router.get("/api/newsletter/export", auth.getUser, route(newsletter.exportSubscribers));
router.post("/api/newsletter/add", auth.getUser, route(newsletter.addSubscriber));
router.get("/api/upload", route(upload.get));
router.post("/api/upload", auth.getUser, fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }), upload.post);
router.delete("/api/upload", auth.getUser, route(upload.delete));
router.post("/api/hygienekonzept", auth.getUser, route(editableWebsite.setEditableWebsiteMiddleware("hygienekonzept")));

// Libraries
router.get("/lib/nprogress.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/nprogress/nprogress.css")));
router.get("/lib/axios.min.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/axios/dist/axios.min.js")));
router.get("/lib/marked.min.js", (req, res) => res.sendFile(path.join(__dirname, "/../node_modules/marked/marked.min.js")));
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
            res.render("routes/workshop", {
                partial: true,
                doctype: "html",
                ...w,
                loggedIn: req.user !== undefined,
                marked,
                permissions: req.user?.permissions || []
            });
        } else {
            res.render("routes/workshop", {
                route: "workshop/" + req.params.workshopID,
                ...w,
                loggedIn: req.user !== undefined,
                marked,
                permissions: req.user?.permissions || []
            });
        }
    }
});

router.get("/workshops/:page", auth.getUser, async (req, res) => {
    let page = parseInt(req.params.page);
    let w = await workshops.getWorkshops(req.user !== undefined, page);
    if (!w || w.length === 0) {
        res.status(404);
        res.render("404");
    } else {
        res.render("routes/workshops", {
            route: req.params.route,
            doctype: "html",
            partial: req.query.partial,
            workshops: w,
            loggedIn: req.user !== undefined,
            page
        });
    }
});

router.get("/newsletter-preview/:workshopID", auth.getUser, async (req, res) => {
    let w = await workshops.getWorkshop(req.params.workshopID, true);
    if (!req.user || !w) {
        res.sendStatus(400);
    } else {
        let baseUrl = process.env.TEST ? "http://localhost:" + config.port : "https://improtheater-frankfurt.de";
        let logo = baseUrl + "/public/img/Improtheater-Frankfurt-Logo.png";
        let website = baseUrl + "/workshop/"+ w.id;
        let subscriber = {
            name: req.user.username,
            subscribedTo: w.type
        }
        let textColor = newsletter.calcTextColor(w.color);
        res.render("emails/newsletter", {
            ...w,
            unsubscribe: "#",
            subscribe: "#",
            logo,
            subscriber,
            marked,
            textColor,
            website
        });
    }
});

router.get("/:route", auth.getUser, async (req, res) => {
    if (!routes.includes(req.params.route)) {
        res.status(404);
        res.render("404");
    } else {
        if (req.query.partial) {
            res.render("routes/" + req.params.route, { partial: true, doctype: "html", ...(await getRenderOptions(req.params.route, req.user !== undefined, req.query)) });
        } else {
            res.render("routes/" + req.params.route, {
                route: req.params.route,
                ...(await getRenderOptions(req.params.route, req.user !== undefined, req.query))
            });
        }
    }
});

module.exports = router;

async function getRenderOptions(route, loggedIn, query) {
    switch(route) {
        case "workshops":
            return { loggedIn, workshops: await workshops.getWorkshops(loggedIn), page: 0 };
        case "newsletter":
            return { loggedIn, subscriber: await newsletter.getSubscriber(query.token), unsubscribe: query.unsubscribe, subscribe: query.subscribe };
        case "subscribers":
            let subscribers = [];
            if (loggedIn) {
                subscribers = await newsletter.getSubscribers();
                let format = new Intl.DateTimeFormat("de-DE");
                for (let subscriber of subscribers)
                    subscriber.last_viewed_newsletter_date = format.format(subscriber.last_viewed_newsletter * 1000);
            }
            return { loggedIn, subscribers };
        case "hygienekonzept":
            return { loggedIn, marked, content: await editableWebsite.getEditableWebsite("hygienekonzept") };
        case "uploads":
            return { loggedIn, uploads: await upload.getAll() };
        default:
            return { loggedIn };
    }
}
