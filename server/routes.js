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
const { wrapRoute: route, routeITF, routeImproglycerin, base_url } = require("./utils");

const router = express.Router();

const routes = {
    improglycerin: {
        "impressum": "common/impressum.pug",
        "newsletter": "common/newsletter.pug",
        "subscribers": "common/subscribers.pug",
        "uploads": "common/uploads.pug",
        "show": "common/workshop.pug",
        "shows": "common/workshops.pug",
        "start": "improglycerin/start.pug",
    },
    itf: {
        "impressum": "common/impressum.pug",
        "newsletter": "common/newsletter.pug",
        "subscribers": "common/subscribers.pug",
        "uploads": "common/uploads.pug",
        "workshop": "common/workshop.pug",
        "workshops": "common/workshops.pug",
        "start": "itf/start.pug",
        "hygienekonzept": "itf/hygienekonzept.pug",
    },
};

// Redirect trailing slashes
router.use(function (req, res, next) {
    if (req.path.substr(-1) == '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

// Differentiate between improglycerin.de and improtheater-frankfurt.de
router.use((req, res, next) => {
    if (req.hostname.includes("improglycerin"))
        req.website = "improglycerin";
    else
        req.website = "itf";
    next();
});

// Backend
router.get("/robots.txt", (req, res) => res.sendFile(path.join(__dirname, "/../client/robots.txt")));
router.get("/api/authhook", auth.authhook);
router.get("/api/login", auth.getUser, (req, res) => res.redirect(req.query.route || "/"));
router.post("/api/logout", route(auth.logout));
router.post("/api/workshops", auth.getUser, route(workshops.post));
router.put("/api/workshops", auth.getUser, route(workshops.put));
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

async function workshopRoute(req, res) {
    let w = await workshops.getWorkshop(req.params.workshopID, req.user !== undefined);
    if (!w) {
        res.status(404);
        res.render("404");
    } else {
        res.render("routes/common/workshop", {
            route: "workshop/" + req.params.workshopID,
            ...(await getRenderOptions(req, "workshop"))
        });
    }
}

async function workshopsRoute(req, res) {
    let page = parseInt(req.params.page);
    let w = await workshops.getWorkshops(req.user !== undefined, page, req.website === "improglycerin" ? 1 : 2);
    if (!w || w.length === 0) {
        res.status(404);
        res.render("404");
    } else {
        res.render("routes/common/workshops", {
            route: "workshops/" + page,
            ...(await getRenderOptions(req, "workshops"))
        });
    }
}

router.get("/workshop/:workshopID", routeITF, auth.getUser, route(workshopRoute));
router.get("/workshops/:page", routeITF, auth.getUser, route(workshopsRoute));
router.get("/show/:workshopID", routeImproglycerin, auth.getUser, route(workshopRoute));
router.get("/shows/:page", routeImproglycerin, auth.getUser, route(workshopsRoute));

router.get("/newsletter-preview/:workshopID", auth.getUser, route(async (req, res) => {
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
}));

router.get("/:route", auth.getUser, route(async (req, res) => {
    const template = routes[req.website][req.params.route];
    if (!template) {
        res.status(404);
        res.render("404");
    } else {
        res.render("routes/" + template, {
            route: req.params.route,
            ...(await getRenderOptions(req, req.params.route))
        });
    }
}));

module.exports = router;

async function getRenderOptions(req, route) {
    const loggedIn = req.user !== undefined;
    const query = req.query;
    const website = req.website;
    let options = {};
    switch(route) {
        case "show":
        case "workshop": {
            let workshop = await workshops.getWorkshop(req.params.workshopID, loggedIn);
            options = { ...workshop, marked, permissions: req.user?.permissions || [] };
            break;
        }
        case "shows": {
            let page = req.params.page ? parseInt(req.params.page) : 0;
            options = { workshops: await workshops.getWorkshops(loggedIn, page, 2), page };
            break;
        }
        case "workshops": {
            let page = req.params.page ? parseInt(req.params.page) : 0;
            options = { workshops: await workshops.getWorkshops(loggedIn, page, 1), page };
            break;
        }
        case "newsletter": {
            options = { subscriber: await newsletter.getSubscriber(query.token), unsubscribe: query.unsubscribe, subscribe: query.subscribe };
            break;
        }
        case "subscribers": {
            let subscribers = [];
            if (loggedIn) {
                subscribers = await newsletter.getSubscribers();
                let format = new Intl.DateTimeFormat("de-DE");
                for (let subscriber of subscribers)
                    subscriber.last_viewed_newsletter_date = format.format(subscriber.last_viewed_newsletter * 1000);
            }
            options = { subscribers };
            break;
        }
        case "hygienekonzept": {
            options = { marked, content: await editableWebsite.getEditableWebsite("hygienekonzept") };
            break;
        }
        case "uploads": {
            options = { uploads: await upload.getAll() };
            break;
        }
    }
    let improglycerinUrl = base_url("improglycerin");
    let itfUrl = base_url("itf");
    return Object.assign(options, { loggedIn, website, doctype: "html", partial: query.partial, improglycerinUrl, itfUrl });
}
