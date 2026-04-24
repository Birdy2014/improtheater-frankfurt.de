import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fileUpload from "express-fileupload";
import { Marked } from "marked";
import * as esbuild from "esbuild";
import * as auth from "./auth.js";
import * as workshops from "./workshops.js";
import * as newsletter from "./newsletter.js";
import * as upload from "./upload.js";
import * as utils from "./utils.js";
import * as logger from "./logger.js";
import { common_marked_options } from "../common/marked_options";
import { Subscriber } from "./db.js";

const router = express.Router();
const marked = new Marked(common_marked_options(undefined));

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
    "shows",
    "newsletter_status"
];

// Redirect trailing slashes
router.use(function (req: Request, res: Response, next: NextFunction) {
    if (req.path.slice(-1) == '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

// Set security headers
router.use((_: Request, res: Response, next: NextFunction) => {
    res.set("Content-Security-Policy", [
        "default-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' https://analytics.improglycerin.de https://challenges.cloudflare.com",
        "img-src 'self' https://improglycerin.de",
        "frame-ancestors https://improglycerin.de http://localhost:3000",
        "frame-src https://challenges.cloudflare.com",
        "connect-src 'self' https://analytics.improglycerin.de",
    ].map(line => line + ";").join(" "));
    next();
})

function cors_allow_all(_: Request, res: Response, next: NextFunction) {
    res.set("Access-Control-Allow-Origin", "*");
    next();
}

function cors_allow_improglycerin(req: Request, res: Response, next: NextFunction) {
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
router.get("/robots.txt", (_: Request, res: Response) => res.sendFile(path.join(utils.project_path, "/client/robots.txt")));
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
router.post("/api/newsletter/confirm", newsletter.confirm);
router.post("/api/newsletter/unsubscribe", newsletter.unsubscribe);
router.post("/api/newsletter/send", auth.getUser, newsletter.send);
router.get("/api/newsletter/export", auth.getUser, newsletter.exportSubscribers);
router.post("/api/newsletter/add", auth.getUser, newsletter.addSubscriber);
router.get("/api/newsletter/status", auth.getUser, newsletter.api_get_status);
router.post("/api/newsletter/cancel", auth.getUser, newsletter.api_post_cancel);
router.get("/api/upload", upload.get); // Old
router.get("/api/upload/:id", upload.get);
router.get("/api/upload-color/:id", upload.get_color);
router.post("/api/upload", auth.getUser, fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }), upload.post);
router.delete("/api/upload/:id", auth.getUser, upload.del);

// Libraries
router.get("/lib/nprogress.js", (_: Request, res: Response) => res.sendFile(path.join(utils.project_path, "/node_modules/nprogress/nprogress.js")));
router.get("/lib/nprogress.css", (_: Request, res: Response) => res.sendFile(path.join(utils.project_path, "/node_modules/nprogress/nprogress.css")));
router.get("/lib/marked.umd.js", (_: Request, res: Response) => res.sendFile(path.join(utils.project_path, "/node_modules/marked/lib/marked.umd.js")));

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
let esbuild_result: esbuild.BuildResult | undefined;

router.use("/resource/:name", async (req: Request, res: Response) => {
    if (esbuild_result === undefined || process.env.NODE_ENV === "development") {
        esbuild_result = await esbuild_context_js.rebuild();
    }

    switch (req.params.name) {
    case "index.js":
        res.contentType("application/javascript").send(esbuild_result.outputFiles![0].text);
        return;
    case "index.css":
        res.contentType("text/css").send(esbuild_result.outputFiles![1].text);
        return;
    }
});

// Frontend
router.get("/", (_: Request, res: Response) => {
    res.redirect("/start")
});

// Workaround for apache
router.get("/index.html", (_: Request, res: Response) => {
    res.redirect("/start");
});

router.get("/workshop/:workshopID", auth.getUser, (req: Request, res: Response) => {
    res.set("X-Robots-Tag", "noindex");

    let w = workshops.getWorkshop(parseInt(String(req.params.workshopID)), req.user !== undefined);
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
        });
    } else {
        res.render("routes/workshop", {
            route: "workshop/" + req.params.workshopID,
            canonical_url: utils.config.base_url + "/workshop/" + req.params.workshopID,
            ...w,
            loggedIn: req.user !== undefined,
            marked,
        });
    }
});

router.get("/workshops/:page", auth.getUser, async (req: Request, res: Response) => {
    if (!req.user) {
        throw new utils.HTTPError(401);
    }

    let page = parseInt(String(req.params.page));
    let w = workshops.getWorkshops(req.user !== undefined, page, req.user !== undefined ? workshops.WorkshopType.Both : workshops.WorkshopType.Itf);
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

router.get("/:route", auth.getUser, async (req: Request, res: Response) => {
    const route = req.params.route as string;
    if (!routes.includes(route)) {
        throw new utils.HTTPError(404);
    }

    const render_options = getRenderOptions(route, req.user, req.query as Record<string, string>);

    const start_time = process.hrtime();

    if (req.query.partial) {
        res.render("routes/" + route, { partial: true, doctype: "html", ...render_options });
    } else {
        res.render("routes/" + route, {
            route: route,
            ...render_options
        });
    }

    const duration = process.hrtime(start_time);
    if (duration[0] >= 1) {
        logger.warn(`rendering of route '${route}' took ${duration[0]}s ${duration[1] / 1000000}ms`);
    }
});

export default router;

function getRenderOptions(route: string, user: Express.Request["user"], query: Record<string, string>) {
    const loggedIn = user !== undefined;

    switch(route) {
        case "workshops":
            return { loggedIn, workshops: workshops.getWorkshops(loggedIn, 0, loggedIn ? workshops.WorkshopType.Both : workshops.WorkshopType.Itf), page: 0 };
        case "shows":
            return { loggedIn: false, workshops: workshops.getWorkshops(false, 0, workshops.WorkshopType.Improglycerin), page: 0 };
        case "newsletter":
            const token = query.token;
            const unsubscribe = query.unsubscribe;
            const subscribe = query.subscribe;
            return { loggedIn, subscriber: newsletter.getSubscriber(token), unsubscribe, subscribe };
        case "subscribers":
            let renderableSubscribers: (Subscriber & { last_viewed_newsletter_date: string })[] = [];
            if (loggedIn) {
                const subscribers = newsletter.getSubscribers();
                const format = new Intl.DateTimeFormat("de-DE");
                renderableSubscribers = subscribers.map(subscriber => ({
                    ...subscriber,
                    last_viewed_newsletter_date: format.format(subscriber.last_viewed_newsletter * 1000),
                }));
            }
            return { loggedIn, subscribers: renderableSubscribers };
        case "uploads":
            return { loggedIn, uploads: upload.getAll() };
        case "user":
            return { loggedIn, user, users: auth.get_users() };
        default:
            return { loggedIn };
    }
}
