window.onload = () => {
    NProgress.configure({ showSpinner: false });
    navigate(currentRoute);
}

document.onclick = e => {
    e = e || window.event;
    let element = e.target || e.srcElement;

    if (element.tagName !== "A") element = element.closest("a");
    if (element) {
        let host = window.location.href.substring(0, window.location.href.indexOf("/", window.location.protocol.length + 2));
        if (!element.href || !element.href.startsWith(host) || element.classList.contains("forceReload"))
            return true;

        navigate(element.href.substring(host.length));
        return false;
    }
}

window.onpopstate = e => {
    navigate(document.location.pathname.substring(1), false, true);
}

async function navigate(to, reload, skipPushState) {
    if (to.startsWith("/")) to = to.substring(1);
    let targetContainer = document.getElementById(to);
    if (!targetContainer) {
        targetContainer = document.createElement("div");
        targetContainer.id = to;
        targetContainer.classList.add("container");
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
        targetContainer.innerHTML = website.data;
        loadPage(targetContainer, to);
    }
    // set link anctive
    let links = document.getElementsByClassName("navlink");
    for (let link of links) {
        if (link.href.endsWith(to))
            link.classList.add("active");
        else
            link.classList.remove("active");
    }
    // set variable
    currentRoute = to;
    // hide / unhide fields where login is required
    for (let element of document.getElementsByClassName("loginrequired")) {
        element.style.display = loggedIn ? "inline-block" : "";
    }
    // navigate
    for (let container of containers) {
        container.style = "display: none";
    }
    targetContainer.style = "display: block";
    // collapse menu
    toggleMenu(true);
    // Push state
    if (!skipPushState)
        history.pushState({}, "", "/" + to);
}

function toggleMenu(hideMenu) {
    let menu = document.getElementById("main-menu");
    let logo = document.getElementById("logo");

    if (hideMenu) {
        hide();
        return;
    }

    // toggle
    if (menu.style.display) {
        hide();
    } else {
        show();
    }

    function hide() {
        menu.style.display = "";
        logo.style.display = ""
    }

    function show() {
        menu.style.display = "block";
        logo.style.display = "none";
    }
}

// Initial page load scripts
function loadPage(parent, page) {
    switch(page) {
        case "admin": {
            let script = document.createElement("script");
            script.src = "/public/js/admin.js";
            parent.appendChild(script);
        }
        case "workshops": {
            let script = document.createElement("script");
            script.src = "/public/js/workshops.js";
            parent.appendChild(script);
        }
        case "workshop": {
            let script = document.createElement("script");
            script.src = "/public/js/workshop.js";
            parent.appendChild(script);
        }
    }
}

function logout() {
    axios.post("/api/logout");
    loggedIn = false;
    navigate("start");
}
