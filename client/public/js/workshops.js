async function createWorkshop() {
    try {
        let response = await axios.post("/api/workshops");
        let id = response.data.data.id;
        navigate("workshops", true, true, true);
        await navigate(`workshop/${id}`, true);
        toggleWorkshopPreview();
    } catch(e) {
        showError(e);
    }
}

function editWorkshopItem(workshop) {
    const list = document.getElementById("workshop-list");
    if (!list)
        return;
    const timeDateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
    let timeText = "";
    if (!workshop.propertiesHidden && workshop.begin && workshop.end) {
        if (typeof timeDateFormat.formatRange !== "undefined")
            timeText = timeDateFormat.formatRange(workshop.begin * 1000, workshop.end * 1000);
        else // Workaround for everything except Chrome
            timeText = timeDateFormat.format(workshop.begin * 1000) + " - " + timeDateFormat.format(workshop.end * 1000);
    }
    let item = list.querySelector("#workshop-item-" + workshop.id);
    if (item) {
        if (workshop.img) item.querySelector("img").src = "/api/upload/" + workshop.img || "/public/img/workshop-default.png";
        if (workshop.title) item.querySelector("h2").innerHTML = workshop.title + (workshop.visible ? "<span>Entwurf</span>" : "");
        if (timeText || workshop.propertiesHidden) item.querySelector("h4").innerHTML = timeText;
        if (workshop.visible !== undefined) item.querySelector(".workshops-draft-text").innerText = workshop.visible ? "" : "Entwurf";
        if (workshop.color) {
            const text_container = item.querySelector(".workshop-text");
            text_container.style["background-color"] = workshop.color;
            if (window.workshop_calcTextColor !== undefined)
                text_container.style.color = workshop_calcTextColor(workshop.color);
        }
    } else {
        const template = document.getElementById("template-workshop-item");
        const fragment = template.content.cloneNode(true);
        item = fragment.children[0];

        if (workshop.outdated)
            item.classList.push("workshops-outdated");
        item.id = "workshop-item-" + workshop.id;
        item.querySelector("a").href = "/workshop/" + workshop.id;
        item.querySelector("img").src = workshop.img || "/public/img/workshop-default.png";
        item.querySelector("h2").innerHTML = workshop.title;
        item.querySelector(".workshops-draft-text").innerText = workshop.visible ? "Entwurf" : "";
        if (workshop.propertiesHidden)
            item.querySelector("h4").innerHTML = "";
        else
            item.querySelector("h4").innerHTML = timeText || "Keine Zeit angegeben";

        const text_container = item.querySelector(".workshop-text");
        text_container.style["background-color"] = workshop.color;
        if (window.workshop_calcTextColor !== undefined)
            text_container.style.color = workshop_calcTextColor(workshop.color);

        list.prepend(item);
    }
}
