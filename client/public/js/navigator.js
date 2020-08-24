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
    loadPage(container, route);
}

document.onclick = e => {
    e = e || window.event;
    let element = e.target || e.srcElement;

    if (element.tagName !== "A") element = element.closest("a");
    if (element) {
        let host = window.location.href.substring(0, window.location.href.indexOf("/", window.location.protocol.length + 2));
        if (!element.href || !element.href.startsWith(host) || element.classList.contains("forceReload")) {
            if (element.href.endsWith("/api/login")) document.cookie='route=' + window.location.pathname;
            return true;
        }

        navigate(element.href.substring(host.length));
        return false;
    }
}

window.onpopstate = e => {
    navigate(document.location.pathname.substring(1), false, true);
}

window.onscroll = e => {
    const navbar = document.getElementsByTagName("nav")[0];
    const wrapper = document.getElementById("wrapper");
    if (window.pageYOffset > 0) {
        navbar.classList.add("nav-sticky");
        wrapper.style.marginTop = "80px";
    } else {
        navbar.classList.remove("nav-sticky");
        wrapper.style.removeProperty("margin-top");
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
        loadPage(targetContainer, route);
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
    // Push state
    if (!skipPushState) {
        history.pushState({}, "", "/" + route);
    }
}

function toggleMenu(hideMenu) {
    let nav = document.getElementsByTagName("nav")[0];
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
        nav.style.removeProperty("height");
        main_menu.style.removeProperty("display");
    }

    function show() {
        nav.style.height = "auto";
        main_menu.style.display = "block";
    }
}

// Initial page load scripts
function loadPage(parent, page) {
    if (page.includes("/")) page = page.substring(0, page.indexOf("/"));
    switch(page) {
        case "workshops": {
            let script = document.createElement("script");
            script.src = "/public/js/workshops.js";
            parent.appendChild(script);
            break;
        }
        case "workshop": {
            let script = document.createElement("script");
            script.src = "/public/js/workshop.js";
            parent.appendChild(script);
            break;
        }
        case "newsletter": {
            let script = document.createElement("script");
            script.src = "/public/js/newsletter.js";
            parent.appendChild(script);
            break;
        }
        case "uploads": {
            let script = document.createElement("script");
            script.src = "/public/js/uploads.js";
            parent.appendChild(script);
            break;
        }
    }
}

async function logout() {
    await axios.post("/api/logout");
    window.location.reload(false); 
}
