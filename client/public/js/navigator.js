window.onload = () => {
    NProgress.configure({ showSpinner: false });
    navigate(route);
}

document.onclick = e => {
    e = e || window.event;
    let element = e.target || e.srcElement;

    if (element.tagName === "A") {
        let host = window.location.href.substring(0, window.location.href.indexOf("/", window.location.protocol.length + 2));
        if (!element.href || !element.href.startsWith(host))
            return true;

        navigate(element.href.substring(host.length));
        return false;
    }
}

async function navigate(to) {
    if (to.startsWith("/")) to = to.substring(1);
    let targetContainer = document.getElementById(to);
    if (!targetContainer) {
        targetContainer = document.createElement("div");
        targetContainer.id = to;
        targetContainer.classList.add("container");
        document.getElementById("wrapper").appendChild(targetContainer);
    }
    let containers = document.getElementsByClassName("container");
    if (targetContainer.childElementCount === 0) {
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
    }
    // set link anctive
    let links = document.getElementsByClassName("navlink");
    for (let link of links) {
        if (link.href.endsWith(to))
            link.classList.add("active");
        else
            link.classList.remove("active");
    }
    // navigate
    for (let container of containers) {
        container.style = "display: none";
    }
    targetContainer.style = "display: block";
    history.pushState({}, "", "/" + to);
}
