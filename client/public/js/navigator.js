window.onload = () => {
    NProgress.configure({ showSpinner: false });
    let url = new URL(document.location.href);
    var currentRoute = url.pathname + url.search;
    // set navlink active
    if (url.search)
        navigate(currentRoute, false, false, false);
    else
        navigate(currentRoute, false, true, false);
    // load scripts
    let route = url.pathname.substring(1);
    let container = document.getElementById(route);
    loadPage(container, route, url.search);
}

document.onclick = e => {
    e = e || window.event;
    let element = e.target || e.srcElement;
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
        let host = window.location.href.substring(0, window.location.href.indexOf("/", window.location.protocol.length + 2));
        if (element.href && element.href.startsWith(host) && !element.classList.contains("forceReload")) {
            navigate(element.href.substring(host.length));
            return false;
        }

        if (element.href.endsWith("/api/login")) {
            location.href = "/api/login?route=" + location.pathname;
            return false;
        }
        return true;
    }
}

window.onpopstate = e => {
    navigate(document.location.pathname.substring(1), false, true);
}

window.onscroll = e => {
    const navbar = document.getElementsByTagName("nav")[0];
    const footer = document.querySelector("footer");
    if (window.pageYOffset > 0) {
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
 * @param {boolean} reload - download page again
 * @param {boolean} skipPushState - don't push route to browser history
 * @param {boolean} preload - only download, don't navigate
 */
async function navigate(to, reload, skipPushState, preload) {
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
    if (targetContainer.childElementCount === 0 || reload) {
        // clear container
        targetContainer.innerHTML = "";
        // download page
        let website = { data: "Error" };
        NProgress.start();
        try {
            let url = to.includes("?") ? "/" + to + "&partial=1" : "/" + to + "?partial=1";
            website = await axios.get(url);
            NProgress.done();
        } catch(e) {
            NProgress.done();
            console.error("Cannot navigate to '" + to + "': " + e);
            return;
        }
        if (!website.headers["content-type"].startsWith("text")) {
            window.location.href = "/" + to;
            return;
        }
        targetContainer.innerHTML = website.data;
        setTimeout(() => loadPage(targetContainer, route, to.includes("?") ? to.substring(to.indexOf("?")) : ""), 100);
    }
    if (preload) return;
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
    if (!skipPushState) {
        history.pushState({}, "", "/" + route);
    }
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
    }

    function show() {
        main_menu.style.display = "block";
    }
}

// Initial page load scripts
function loadPage(parent, page, query) {
    if (page.includes("/")) page = page.substring(0, page.indexOf("/"));
    if (!document.getElementById("script-" + page)) {
        let script = document.createElement("script");
        script.id = "script-" + page;
        script.src = "/public/js/" + page + ".js";
        script.onload = () => initRoute(page, parent, query);
        document.head.append(script);
    } else {
        initRoute(page, parent, query);
    }
}

function initRoute(route, container, query) {
    if (window[route + "_init"])
        window[route + "_init"](container, query);
}

async function logout() {
    await axios.post("/api/logout");
    window.location.reload();
}

// Alerts
const ALERT_LOADING = "#alert-loading";
const ALERT_SUCCESS = "#alert-success";
const ALERT_ERROR = "#alert-error";
let alert_timeout;

function alert(type, message, autohide) {
    let element = document.querySelector(type);
    if (!element)
        throw new Error("Invalid alert type");
    alertClose();
    element.querySelector(".alert-text").innerHTML = message;
    element.style.top = "10px";
    if (autohide || (autohide === undefined && type !== ALERT_LOADING))
        alert_timeout = setTimeout(alertClose, 3000);
}

function alertGetOpen() {
    let elements = document.querySelectorAll(".alert");
    for (const element of elements) {
        if (element.style.top)
            return element;
    }
}

function alertClose() {
    clearTimeout(alert_timeout);
    let element = alertGetOpen();
    if (!element)
        return;
    element.style.removeProperty("top");
    let textElement = element.querySelector(".alert-text");
    textElement.innerHTML = "";
    textElement.style.removeProperty("white-space");
    if (window.rejectConfirmDialog) {
        window.rejectConfirmDialog();
        window.rejectConfirmDialog = undefined;
    }
}

function alertToggleFull() {
    let element = alertGetOpen();
    let textElement = element.querySelector(".alert-text");
    if (textElement.style["white-space"])
        textElement.style.removeProperty("white-space");
    else
        textElement.style["white-space"] = "normal";
}

function showError(error) {
    let errorText = "Ein Fehler ist aufgetreten: ";
    if (error.response) {
        errorText += "Status: " + JSON.stringify(error.response.status, null, 4) + "; ";
        errorText += "Data: " + JSON.stringify(error.response.data, null, 4);
    } else {
        errorText += error.message;
    }
    alert(ALERT_ERROR, errorText, false);
}

function confirm(text) {
    return new Promise((resolve, reject) => {
        alert("#alert-confirm", text, false);
        window.rejectConfirmDialog = reject;
        const alert_confirm = document.querySelector("#alert-confirm");
        const yes = alert_confirm.querySelector(".alert-confirm-yes");
        const no = alert_confirm.querySelector(".alert-confirm-no");
        yes.addEventListener('click', () => {
            window.rejectConfirmDialog = undefined;
            alertClose();
            resolve(true);
        });
        no.addEventListener('click', () => {
            window.rejectConfirmDialog = undefined;
            alertClose();
            resolve(false);
        });
    });
}
