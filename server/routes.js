import express from "express";
import path from "path";
import fileUpload from "express-fileupload";
import { marked } from "marked";
import * as esbuild from "esbuild";
import * as auth from "./auth.js";
import * as workshops from "./workshops.js";
import * as newsletter from "./newsletter.js";
import * as upload from "./upload.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";

const router = express.Router();

// Get all routes
const routes = [
    "impressum",
    "datenschutz",
    "newsletter",
    "start",
    "subscribers",
    "uploads",
    "workshops",
    "login",
    "user",
    "password_reset",
    "shows"
];

// Redirect trailing slashes
router.use(function (req, res, next) {
    if (req.path.slice(-1) == '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

// Set security headers
router.use((_, res, next) => {
    res.set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://analytics.improglycerin.de; img-src 'self' https://improglycerin.de; frame-ancestors https://improglycerin.de;");
    next();
})

function cors_allow_all(_, res, next) {
    res.set("Access-Control-Allow-Origin", "*");
    next();
}

function cors_allow_improglycerin(req, res, next) {
    const origin = req.get("Origin");
    if (!origin) {
        next();
        return;
    }
    const allowed_origins = /^https:\/\/(.*\.)?improglycerin\.de|http:\/\/localhost(:[0-9]+)?$/;
    if (allowed_origins.test(origin.toLowerCase())) {
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Access-Control-Allow-Headers", "*");
    }
    next();
}

// Backend
router.get("/robots.txt", (_, res) => res.sendFile(path.join(utils.project_path, "/client/robots.txt")));
router.post("/api/login", auth.login);
router.post("/api/logout", auth.logout);
router.post("/api/user", auth.getUser, auth.api_create_user);
router.put("/api/user", auth.getUser, auth.api_change_user);
router.delete("/api/user", auth.getUser, auth.api_delete_user);
router.post("/api/user/request_password_reset", auth.api_request_password_reset);
router.post("/api/user/password_reset", auth.api_password_reset);
router.get("/api/workshops", auth.getUser, workshops.api_get);
router.post("/api/workshops", auth.getUser, workshops.post);
router.delete("/api/workshops", auth.getUser, workshops.del);
router.post("/api/workshop/copy", auth.getUser, workshops.copy);
router.options("/api/newsletter/subscribe", cors_allow_improglycerin);
router.post("/api/newsletter/subscribe", cors_allow_improglycerin, newsletter.subscribe);
router.get("/api/newsletter/confirm", newsletter.confirm);
router.post("/api/newsletter/unsubscribe", newsletter.unsubscribe);
router.post("/api/newsletter/send", auth.getUser, newsletter.send);
router.get("/api/newsletter/export", auth.getUser, newsletter.exportSubscribers);
router.post("/api/newsletter/add", auth.getUser, newsletter.addSubscriber);
router.get("/api/upload", upload.get); // Old
router.get("/api/upload/:id", upload.get);
router.get("/api/upload-color/:id", upload.get_color);
router.post("/api/upload", auth.getUser, fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }), upload.post);
router.delete("/api/upload/:id", auth.getUser, upload.del);

// Libraries
router.get("/lib/nprogress.js", (_, res) => res.sendFile(path.join(utils.project_path, "/node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (_, res) => res.sendFile(path.join(utils.project_path, "/node_modules/nprogress/nprogress.css")));
router.get("/lib/marked.min.js", (_, res) => res.sendFile(path.join(utils.project_path, "/node_modules/marked/marked.min.js")));

// Thunderbird needs CORS to be enabled to load fonts
router.use("/roboto", cors_allow_all, express.static(path.join(utils.project_path, "/node_modules/@fontsource/roboto/files")));

router.use("/public", express.static(path.join(utils.project_path, "/client/public")));

const esbuild_context_js = await esbuild.context({
    entryPoints: [ path.join(utils.project_path, "/client/js/index.js"), path.join(utils.project_path, "/client/css/index.css") ],
    bundle: true,
    minify: process.env.NODE_ENV !== "development",
    write: false,
    outdir: path.join(utils.project_path, "dist"),
    plugins: [
        {
            name: "ignore-external",
            setup(build) {
                build.onResolve({ filter: /^.*\.(woff|woff2|svg)$/ }, args => {
                    return { path: args.path, external: true, };
                });
            },
        }
    ],
});
let esbuild_result;

router.use("/resource/:name", async (req, res) => {
    if (esbuild_result === undefined || process.env.NODE_ENV === "development") {
        esbuild_result = await esbuild_context_js.rebuild();
    }

    switch (req.params.name) {
    case "index.js":
        res.contentType("application/javascript").send(esbuild_result.outputFiles[0].text);
        return;
    case "index.css":
        res.contentType("text/css").send(esbuild_result.outputFiles[1].text);
        return;
    }
});

// Frontend
router.get("/", (_, res) => {
    res.redirect("/start")
});

// Workaround for apache
router.get("/index.html", (_, res) => {
    res.redirect("/start");
});

router.get("/workshop/:workshopID", auth.getUser, (req, res) => {
    res.set("X-Robots-Tag", "noindex");

    let w = workshops.getWorkshop(req.params.workshopID, req.user !== undefined);
    if (!w) {
        throw new utils.HTTPError(404);
    }

    if (req.query.partial) {
        res.render("routes/workshop", {
            partial: true,
            doctype: "html",
            ...w,
            loggedIn: req.user !== undefined,
            marked,
            full_access: req.user?.full_access || false
        });
    } else {
        res.render("routes/workshop", {
            route: "workshop/" + req.params.workshopID,
            canonical_url: utils.config.base_url + "/workshop/" + req.params.workshopID,
            ...w,
            loggedIn: req.user !== undefined,
            marked,
            full_access: req.user?.full_access || false
        });
    }
});

router.get("/workshops/:page", auth.getUser, async (req, res) => {
    if (!req.user) {
        throw new utils.HTTPError(401);
    }

    let page = parseInt(req.params.page);
    let w = workshops.getWorkshops(req.user !== undefined, page, req.user !== undefined ? workshops.type_both : workshops.type_itf);
    if (!w || w.length === 0) {
        throw new utils.HTTPError(404);
    }

    res.render("routes/workshops", {
        route: `workshops/${req.params.page}`,
        doctype: "html",
        partial: req.query.partial,
        workshops: w,
        loggedIn: req.user !== undefined,
        page
    });
});

router.get("/newsletter-preview", auth.getUser, newsletter.preview);

router.get("/:route", auth.getUser, async (req, res) => {
    if (!routes.includes(req.params.route)) {
        throw new utils.HTTPError(404);
    }

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
    if (duration[0] >= 1) {
        logger.warn(`rendering of route '${req.params.route}' took ${duration[0]}s ${duration[1] / 1000000}ms`);
    }
});

export default router;

function getRenderOptions(route, user, query) {
    const loggedIn = user !== undefined;

    switch(route) {
        case "workshops":
            return { loggedIn, workshops: workshops.getWorkshops(loggedIn, 0, loggedIn ? workshops.type_both : workshops.type_itf), page: 0 };
        case "shows":
            return { loggedIn: false, workshops: workshops.getWorkshops(loggedIn, 0, workshops.type_improglycerin), page: 0 };
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
        case "uploads":
            return { loggedIn, uploads: upload.getAll() };
        case "user":
            return { loggedIn, user, users: auth.get_users() };
        default:
            return { loggedIn };
    }
}
