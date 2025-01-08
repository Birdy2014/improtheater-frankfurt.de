import * as request from "./request.js";

window.onload = () => {
    NProgress.configure({ showSpinner: false });
    let url = new URL(document.location.href);
    var currentRoute = url.pathname + url.search;
    // set navlink active
    if (url.search)
        navigate(currentRoute);
    else
        navigate(currentRoute);
    // load scripts
    let route = url.pathname.substring(1);
    let container = document.getElementById(route);
    initRoute(route, container, url.search);

    document.querySelectorAll(".message-text").forEach(element => element.addEventListener("click", _ => toggle_message_details()));
    document.querySelectorAll(".message-close").forEach(element => element.addEventListener("click", _ => close_message()));
    document.getElementById("menu-toggle-button").addEventListener("click", _ => toggleMenu());
    document.getElementById("logout-button")?.addEventListener("click", _ => logout());
}

document.onclick = event => {
    let element = event.target;
    if (element.tagName !== "A") element = element.closest("a");

    let dropdownContent;
    if (element && element.parentElement.classList.contains("dropdown"))
        dropdownContent = element.parentElement.querySelector("div");
    for (let dropdown of document.querySelectorAll(".dropdown")) {
        let content = dropdown.querySelector("div");
        if (content !== dropdownContent)
            content.style.removeProperty("display");
    }
    if (dropdownContent) {
        if (dropdownContent.style.display === "block")
            dropdownContent.style.removeProperty("display");
        else
            dropdownContent.style.display = "block";
        return false;
    }

    if (element) {
        const url = new URL(element.href);
        if (url.pathname === "/login") {
            console.log(`/login?route=${location.pathname}`);
            navigate(`/login?route=${location.pathname}`);
            return false;
        }

        let host = window.location.href.substring(0, window.location.href.indexOf("/", window.location.protocol.length + 2));
        if (element.href && element.href.startsWith(host) && !element.classList.contains("forceReload")) {
            navigate(element.href.substring(host.length));
            return false;
        }
        return true;
    }
}

window.onpopstate = _ => {
    navigate(document.location.pathname.substring(1), { push_history: false });
}

window.onscroll = _ => {
    const navbar = document.getElementsByTagName("nav")[0];
    const footer = document.querySelector("footer");
    if (window.scrollY > 0) {
        navbar.classList.add("nav-sticky");
        footer.style.marginBottom = "25px";
    } else {
        navbar.classList.remove("nav-sticky");
        footer.style.removeProperty("margin-bottom");
    }
}

/**
 *
 * @param {string} to - target route
 * @param {boolean} params.reload - download page again
 * @param {boolean} params.push_history - don't push route to browser history
 * @param {boolean} params.preload - only download, don't navigate
 */
export async function navigate(to, params = { }) {
    params = Object.assign({
        reload: false,
        push_history: true,
        preload: false
    }, params);

    if (to.startsWith("/")) to = to.substring(1);
    let route = to;
    if (route.includes("?"))
        route = route.substring(0, to.indexOf("?"));
    let targetContainer = document.getElementById(route);
    if (!targetContainer) {
        targetContainer = document.createElement("div");
        targetContainer.id = route;
        targetContainer.classList.add("container");
        targetContainer.style.display = "none";
        document.getElementById("wrapper").appendChild(targetContainer);
    }
    let containers = document.getElementsByClassName("container");
    let load_promise;
    if (targetContainer.childElementCount === 0 || params.reload) {
        // clear container
        targetContainer.innerHTML = "";
        // download page
        let website = { data: "Error" };
        NProgress.start();
        try {
            let url = to.includes("?") ? "/" + to + "&partial=1" : "/" + to + "?partial=1";
            website = await request.get(url);
            NProgress.done();
        } catch(error) {
            NProgress.done();
            console.error("Cannot navigate to '" + to + "': " + error);

            // Redirect to login
            if (error.response.status == 401 && to != "login") {
                navigate("login");
            }
            return;
        }
        if (!website.headers.get("content-type").startsWith("text")) {
            window.location.href = "/" + to;
            return;
        }
        targetContainer.innerHTML = website.data;

        load_promise = new Promise(resolve => {
            setTimeout(_ => {
                initRoute(route, targetContainer, to.includes("?") ? to.substring(to.indexOf("?")) : "");
                resolve();
            }, 100);
        });
    }
    if (params.preload) {
        await load_promise;
        return;
    }
    // set link anctive
    let links = document.getElementsByClassName("navlink");
    for (let link of links) {
        if (link.href.endsWith(route))
            link.classList.add("active");
        else
            link.classList.remove("active");
    }
    // set variable
    currentRoute = to;
    // navigate
    for (let container of containers) {
        container.style = "display: none";
    }
    targetContainer.style = "display: block";
    // collapse menu
    toggleMenu(true);
    // Scroll to top
    window.scrollTo(0, 0);
    // Push state
    if (params.push_history) {
        history.pushState({}, "", "/" + route);
    }
    await load_promise;
}

function toggleMenu(hideMenu) {
    let main_menu = document.getElementById("main-menu");

    if (hideMenu) {
        hide();
        return;
    }

    // toggle
    if (main_menu.style.display) {
        hide();
    } else {
        show();
    }

    function hide() {
        main_menu.style.removeProperty("display");
        window.wrapper.style.filter = "";
    }

    function show() {
        main_menu.style.display = "block";
        window.wrapper.style.filter = "brightness(50%)";
    }
}

// Initial page load scripts
function initRoute(route, container, query) {
    if (route.includes("/")) route = route.substring(0, route.indexOf("/"));
    if (window[route + "_init"])
        window[route + "_init"](container, query);
}

async function logout() {
    await request.post("/api/logout");
    window.location.reload();
}

// Alerts
export const MESSAGE_SUCCESS = "#message-success";
export const MESSAGE_ERROR = "#message-error";
let message_timeout;

export function show_message(type, message, autohide) {
    let element = document.querySelector(type);
    if (!element)
        throw new Error("Invalid message type");
    close_message();
    element.querySelector(".message-text").innerHTML = message;
    element.style.top = "10px";
    if (autohide || autohide === undefined)
        message_timeout = setTimeout(close_message, 3000);
}

function get_visible_message() {
    let elements = document.querySelectorAll(".message");
    for (const element of elements) {
        if (element.style.top)
            return element;
    }
}

function close_message() {
    clearTimeout(message_timeout);
    const message_element = get_visible_message();
    if (!message_element)
        return;
    message_element.style.removeProperty("top");
    const textElement = message_element.querySelector(".message-text");
    textElement.innerHTML = "";
    textElement.style.removeProperty("white-space");
}

function toggle_message_details() {
    let element = get_visible_message();
    const textElement = element.querySelector(".message-text");
    if (textElement.style["white-space"])
        textElement.style.removeProperty("white-space");
    else
        textElement.style["white-space"] = "normal";
}

export function show_error(error) {
    let errorText = "Ein Fehler ist aufgetreten: ";
    if (error.response) {
        errorText += "Status: " + error.response.statusText;
        if (error.response.data) {
            errorText += "; Data: " + JSON.stringify(error.response.data, null, 4);
        }
    } else {
        errorText += error.message;
    }
    show_message(MESSAGE_ERROR, errorText, false);
}

export function show_confirm_message(text) {
    if (confirm_message_resolve === undefined)
        init_confirm_message()

    return new Promise((resolve, _) => {
        confirm_message_resolve = resolve;
        show_message("#message-confirm", text, false);
    });
}

let confirm_message_resolve = undefined;

function init_confirm_message() {
    const message_confirm = document.querySelector("#message-confirm");
    const yes = message_confirm.querySelector(".message-confirm-yes");
    const no = message_confirm.querySelector(".message-confirm-no");
    const close = message_confirm.querySelector(".message-close");
    yes.addEventListener('click', () => {
        confirm_message_resolve(true);
        close_message();
    });
    no.addEventListener('click', () => {
        confirm_message_resolve(false);
        close_message();
    });
    close.addEventListener('click', () => {
        confirm_message_resolve(false);
        close_message();
    });
}
