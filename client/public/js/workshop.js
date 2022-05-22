const workshops = {};
const dateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const timeFormat = Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });

if (window.marked) {
    marked.setOptions({
        gfm: true,
        breaks: true,
        smartypants: true
    });
}

async function changeWorkshopValues() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    workshop_updateValues(id);
    if (typeof editWorkshopItem !== "undefined")
        editWorkshopItem(workshops[id].texts);
    try {
        await axios.post("/api/workshops", workshops[id].texts);
        alert(ALERT_SUCCESS, "Daten gespeichert");
    } catch(err) {
        showError(err);
    }
}

async function publishWorkshop() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let button = container.getElementsByClassName("edit-publish")[0];
    workshops[id].buttons.published = !workshops[id].buttons.published;
    if (typeof editWorkshopItem !== "undefined")
        editWorkshopItem({ id, visible: workshops[id].buttons.published });
    await axios.post("/api/workshops", { id, visible: workshops[id].buttons.published ? 1 : 0 });
    if (workshops[id].buttons.published) {
        button.innerHTML = "Unsichtbar machen";
        alert(ALERT_SUCCESS, "Der Workshop ist jetzt sichtbar");
    } else {
        button.innerHTML = "Veröffentlichen";
        alert(ALERT_SUCCESS, "Der Workshop ist jetzt nicht mehr sichtbar");
    }
}

async function deleteWorkshop(id) {
    if (!await confirm("Soll der Newsletter wirklich gelöscht werden?"))
        return;
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    await axios.delete("/api/workshops", {
        data: { id }
    });
    await navigate("workshops", true);
}

function editWorkshopImage() {
    window.sessionStorage.setItem("editWorkshop", currentRoute);
    navigate("uploads");
}

async function sendNewsletter() {
    try {
        let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
        let container = document.getElementById("workshop/" + id);
        if (workshop_changed(id)) {
            alert(ALERT_ERROR, "Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.");
            return;
        }
        if (!await confirm("Soll der Newsletter wirklich so versendet werden?"))
            return;
        await axios.post("/api/newsletter/send", { workshop: id });
        workshops[id].buttons.newsletterSent = true;
        // TODO: Only do this if the user is not allowed to resend newsletters
        container.querySelectorAll(".edit-newsletter").forEach(value => value.style.display = "none");
        alert(ALERT_SUCCESS, "Newsletter gesendet");
    } catch (e) {
        if (e.response.status === 404)
            alert(ALERT_ERROR, "Der Workshop ist noch nicht öffentlich.", false);
        else
            showError(e);
    }
}

async function sendTestNewsletter() {
    try {
        let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
        let container = document.getElementById("workshop/" + id);
        if (workshop_changed(id)) {
            alert(ALERT_ERROR, "Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.");
            return;
        }
        await axios.post("/api/newsletter/send", { workshop: id, test: true });
        alert(ALERT_SUCCESS, "Testmail gesendet");
    } catch (e) {
        showError(e);
    }
}

function textareaAutoGrow(field) {
    if (field.scrollHeight > field.clientHeight)
        field.style.height = field.scrollHeight + "px";
}

function toggleWorkshopPreview() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let title_preview = container.querySelector(".workshop-title");
    let content_preview = container.querySelector(".workshop-content-preview");
    let location_preview = container.querySelector(".workshop-location");
    let price_preview = container.querySelector(".workshop-price");
    let email_preview = container.querySelector(".workshop-email");
    let date_preview = container.querySelector(".workshop-date");
    let time_preview = container.querySelector(".workshop-time");
    let properties = container.querySelector(".workshop-properties");
    let preview_button = container.querySelector(".edit-preview");

    let workshop_edit_fields = container.querySelectorAll(".workshop-edit-field");
    let workshop_preview_fields = container.querySelectorAll(".workshop-preview-field");

    if (workshops[id].buttons.previewToggled) {
        properties.style.display = null;
        properties.style.backgroundColor = null;
        properties.style.color = null;
        preview_button.innerHTML = "Bearbeiten beenden";

        workshop_edit_fields.forEach(element => element.style.display = "block");
        workshop_preview_fields.forEach(element => element.style.display = "none");
    } else {
        workshop_updateValues(id);

        title_preview.innerHTML = marked.parseInline(workshops[id].texts.title);
        content_preview.innerHTML = marked.parse(workshops[id].texts.content);
        workshop_break_links(container);
        location_preview.innerHTML = marked.parseInline(workshops[id].texts.location);
        price_preview.innerHTML = marked.parseInline(workshops[id].texts.price);
        email_preview.innerHTML = marked.parseInline(workshops[id].texts.email);
        date_preview.innerHTML = dateFormat.formatRange(workshops[id].texts.begin * 1000, workshops[id].texts.end * 1000);
        time_preview.innerHTML = timeFormat.formatRange(workshops[id].texts.begin * 1000, workshops[id].texts.end * 1000);
        properties.style.display = workshops[id].texts.propertiesHidden ? "none" : null;
        properties.style.backgroundColor = workshops[id].texts.color;
        properties.style.color = workshop_calcTextColor(workshops[id].texts.color);
        preview_button.innerHTML = "Bearbeiten";

        workshop_edit_fields.forEach(element => element.style.display = "none");
        workshop_preview_fields.forEach(element => element.style.display = "block");
    }
    workshops[id].buttons.previewToggled = !workshops[id].buttons.previewToggled;
}

function workshop_init(container) {
    workshop_break_links(container);

    if (!container.querySelector(".edit-publish"))
        return;

    const route = container.id;
    const id = route.substring(route.indexOf("/") + 1);
    const imgsrc = container.querySelector(".workshop-image").src;
    workshops[id] = {
        texts: {
            id
        },
        buttons: {
            published: container.querySelector(".edit-publish").innerHTML !== "Veröffentlichen",
            previewToggled: true,
            newsletterSent: container.querySelector(".edit-newsletter") === undefined
        },
        current: {
            img: imgsrc.substring(imgsrc.lastIndexOf("name=") + 5)
        }
    }
    workshop_updateValues(id);

    const properties = container.querySelector(".workshop-properties");
    properties.style.display = workshops[id].texts.propertiesHidden ? "none" : null;

    const edit_content = container.querySelector(".edit-content");
    edit_content.addEventListener("keyup", (event) => {
        textareaAutoGrow(event.target);
    });
    textareaAutoGrow(edit_content);
}

function workshop_updateValues(id) {
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    const container = document.getElementById("workshop/" + id);
    workshops[id].texts.title = container.querySelector(".edit-title").value;
    workshops[id].texts.content = container.querySelector(".edit-content").value;
    workshops[id].texts.img = workshops[id].current.img;
    let date = container.querySelector(".input-workshop-date").value;
    let beginTime = container.querySelector(".input-workshop-time-begin").value;
    let endTime = container.querySelector(".input-workshop-time-end").value;
    workshops[id].texts.begin = Date.parse(date + "T" + beginTime) / 1000;
    workshops[id].texts.end = Date.parse(date + "T" + endTime) / 1000;
    workshops[id].texts.location = container.querySelector(".edit-workshop-location").value;
    workshops[id].texts.price = container.querySelector(".edit-workshop-price").value;
    workshops[id].texts.email = container.querySelector(".edit-workshop-email").value;
    workshops[id].texts.color = container.querySelector(".input-workshop-color").value;
    workshops[id].texts.propertiesHidden = container.querySelector(".workshop-input-propertieshidden")?.checked;
    workshops[id].texts.type = container.querySelector(".workshop-input-type").value
}

function workshop_changed(id) {
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    const container = document.getElementById("workshop/" + id);
    let date = container.querySelector(".input-workshop-date").value;
    let beginTime = container.querySelector(".input-workshop-time-begin").value;
    let endTime = container.querySelector(".input-workshop-time-end").value;
    return (
        workshops[id].texts.title !== container.querySelector(".edit-title").value ||
        workshops[id].texts.content !== container.querySelector(".edit-content").value ||
        workshops[id].texts.img !== workshops[id].current.img ||
        workshops[id].texts.begin !== Date.parse(date + "T" + beginTime) / 1000 ||
        workshops[id].texts.end !== Date.parse(date + "T" + endTime) / 1000 ||
        workshops[id].texts.location !== container.querySelector(".edit-workshop-location").value ||
        workshops[id].texts.price !== container.querySelector(".edit-workshop-price").value ||
        workshops[id].texts.email !== container.querySelector(".edit-workshop-email").value ||
        workshops[id].texts.color !== container.querySelector(".input-workshop-color").value ||
        (container.querySelector(".workshop-input-propertieshidden") && workshops[id].texts.propertiesHidden !== container.querySelector(".workshop-input-propertieshidden").checked) ||
        workshops[id].texts.type !== container.querySelector(".workshop-input-type").value
    )
}

function workshop_calcTextColor(backgroundColor) {
    const r = parseInt(backgroundColor.substr(1, 2), 16);
    const g = parseInt(backgroundColor.substr(3, 2), 16);
    const b = parseInt(backgroundColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance > 0.5)
        return "#000000";
    else
        return "#ffffff";
}

function workshop_break_links(container) {
    const content = container.querySelector(".workshop-content-preview");
    const links = content.querySelectorAll("a");

    links.forEach(link => {
        link.innerHTML = link.innerHTML.replaceAll("/", "/<wbr>");
        console.log(link.innerHTML)
    });
}
