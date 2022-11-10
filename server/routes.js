import express from "express";
import path from "path";
import fileUpload from "express-fileupload";
import { marked } from "marked";
import sass from "sass";
import * as auth from "./auth.js";
import * as workshops from "./workshops.js";
import * as newsletter from "./newsletter.js";
import * as upload from "./upload.js";
import * as editableWebsite from "./editableWebsite.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";

const route = utils.wrapRoute;

const router = express.Router();

// Get all routes
const routes = [
    "hygienekonzept",
    "impressum",
    "datenschutz",
    "newsletter",
    "start",
    "subscribers",
    "uploads",
    "workshops",
    "login",
    "user",
    "password_reset"
];

// Redirect trailing slashes
router.use(function (req, res, next) {
    if (req.path.substr(-1) == '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

// Set security headers
router.use((_, res, next) => {
    res.set("X-Frame-Options", "DENY");
    res.set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';");
    next();
})

function cors_allow_all(_, res, next) {
    res.set("Access-Control-Allow-Origin", "*");
    next();
}

// Backend
router.get("/robots.txt", (req, res) => res.sendFile(path.join(utils.project_path, "/client/robots.txt")));
router.post("/api/login", route(auth.login));
router.post("/api/logout", route(auth.logout));
router.post("/api/user", auth.getUser, route(auth.api_create_user));
router.put("/api/user", auth.getUser, route(auth.api_change_user));
router.delete("/api/user", auth.getUser, route(auth.api_delete_user));
router.post("/api/user/request_password_reset", route(auth.api_request_password_reset));
router.post("/api/user/password_reset", route(auth.api_password_reset));
router.post("/api/workshops", auth.getUser, route(workshops.post));
router.delete("/api/workshops", auth.getUser, route(workshops.del));
router.post("/api/newsletter/subscribe", route(newsletter.subscribe));
router.get("/api/newsletter/confirm", route(newsletter.confirm));
router.post("/api/newsletter/unsubscribe", route(newsletter.unsubscribe));
router.post("/api/newsletter/send", auth.getUser, route(newsletter.send));
router.get("/api/newsletter/export", auth.getUser, route(newsletter.exportSubscribers));
router.post("/api/newsletter/add", auth.getUser, route(newsletter.addSubscriber));
router.get("/api/upload", route(upload.get)); // Old
router.get("/api/upload/:name", route(upload.get));
router.get("/api/upload-color/:name", route(upload.get_color));
router.post("/api/upload", auth.getUser, fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }), upload.post);
router.delete("/api/upload/:name", auth.getUser, route(upload.del));
router.post("/api/hygienekonzept", auth.getUser, route(editableWebsite.setEditableWebsiteMiddleware("hygienekonzept")));

// Libraries
router.get("/lib/nprogress.js", (req, res) => res.sendFile(path.join(utils.project_path, "/node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (req, res) => res.sendFile(path.join(utils.project_path, "/node_modules/nprogress/nprogress.css")));
router.get("/lib/axios.min.js", (req, res) => res.sendFile(path.join(utils.project_path, "/node_modules/axios/dist/axios.min.js")));
router.get("/lib/marked.min.js", (req, res) => res.sendFile(path.join(utils.project_path, "/node_modules/marked/marked.min.js")));

// Thunderbird needs CORS to be enabled to load fonts
router.use("/roboto", cors_allow_all, express.static(path.join(utils.project_path, "/node_modules/@fontsource/roboto/files")));

router.use("/public", express.static(path.join(utils.project_path, "/client/public")));
const css = sass.compile(path.join(utils.project_path, "/client/scss/index.scss")).css;
router.use("/index.css", (req, res) => {
    res.contentType("text/css");
    if (process.env.NODE_ENV === "development") {
        res.send(sass.compile(path.join(utils.project_path, "/client/scss/index.scss")).css);
    } else {
        res.send(css);
    }
});

// Frontend
router.get("/", (req, res) => {
    res.redirect("/start")
});

// Workaround for apache
router.get("/index.html", (req, res) => {
    res.redirect("/start");
});

router.get("/workshop/:workshopID", auth.getUser, (req, res) => {
    let w = workshops.getWorkshop(req.params.workshopID, req.user !== undefined);
    if (!w) {
        res.status(404);
        res.render("error", { status: 404, message: "Not Found" });
    } else {
        if (req.query.partial) {
            res.render("routes/workshop", {
                partial: true,
                doctype: "html",
                ...w,
                textColor: newsletter.calcTextColor(w.color),
                loggedIn: req.user !== undefined,
                marked,
                full_access: req.user?.full_access || false
            });
        } else {
            res.render("routes/workshop", {
                route: "workshop/" + req.params.workshopID,
                ...w,
                textColor: newsletter.calcTextColor(w.color),
                loggedIn: req.user !== undefined,
                marked,
                full_access: req.user?.full_access || false
            });
        }
    }
});

router.get("/workshops/:page", auth.getUser, async (req, res) => {
    let page = parseInt(req.params.page);
    let w = workshops.getWorkshops(req.user !== undefined, page);
    if (!w || w.length === 0) {
        res.status(404);
        res.render("error", { status: 404, message: "Not Found" });
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
    let w = workshops.getWorkshop(req.params.workshopID, true);
    if (!req.user || !w) {
        res.sendStatus(400);
    } else {
        let logo = utils.base_url + "/public/img/improtheater_frankfurt_logo.png";
        let website = utils.base_url + "/workshop/"+ w.id;
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
            website,
            base_url: utils.base_url
        });
    }
});

router.get("/:route", auth.getUser, async (req, res) => {
    if (!routes.includes(req.params.route)) {
        res.status(404);
        res.render("error", { status: 404, message: "Not Found" });
    } else {
        const render_options = getRenderOptions(req.params.route, req.user, req.query);

        const start_time = process.hrtime();

        if (req.query.partial) {
            res.render("routes/" + req.params.route, { partial: true, doctype: "html", ...render_options });
        } else {
            res.render("routes/" + req.params.route, {
                route: req.params.route,
                ...render_options
            });
        }

        const duration = process.hrtime(start_time);
        if (duration[0] >= 1)
            logger.warn(`rendering of route '${req.params.route}' took ${duration[0]}s ${duration[1] / 1000000}ms`);
    }
});

export default router;

function getRenderOptions(route, user, query) {
    const loggedIn = user !== undefined;

    switch(route) {
        case "workshops":
            return { loggedIn, workshops: workshops.getWorkshops(loggedIn), page: 0 };
        case "newsletter":
            return { loggedIn, subscriber: newsletter.getSubscriber(query.token), unsubscribe: query.unsubscribe, subscribe: query.subscribe };
        case "subscribers":
            let subscribers = [];
            if (loggedIn) {
                subscribers = newsletter.getSubscribers();
                let format = new Intl.DateTimeFormat("de-DE");
                for (let subscriber of subscribers)
                    subscriber.last_viewed_newsletter_date = format.format(subscriber.last_viewed_newsletter * 1000);
            }
            return { loggedIn, subscribers };
        case "hygienekonzept":
            return { loggedIn, marked, content: editableWebsite.getEditableWebsite("hygienekonzept") };
        case "uploads":
            return { loggedIn, uploads: upload.getAll() };
        case "user":
            return { loggedIn, user, users: auth.get_users() };
        default:
            return { loggedIn };
    }
}
