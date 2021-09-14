const workshops = {};

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
        container.querySelectorAll(".edit-newsletter").forEach(value => value.style.display = "none");
        alert(ALERT_SUCCESS, "Newsletter gesendet");
    } catch (e) {
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
    let content_textarea = container.querySelector(".edit-content");
    let content_preview = container.querySelector(".workshop-content-preview");
    let location_input = container.querySelector(".edit-workshop-location");
    let location_preview = container.querySelector(".workshop-location-preview");
    let price_input = container.querySelector(".edit-workshop-price");
    let price_preview = container.querySelector(".workshop-price-preview");
    let email_input = container.querySelector(".edit-workshop-email");
    let email_preview = container.querySelector(".workshop-email-preview");
    let properties = container.querySelector(".workshop-properties");
    let markdown_examples = container.querySelector(".workshop-markdown-examples");

    if (workshops[id].buttons.previewToggled) {
        content_textarea.style.display = "block";
        content_preview.style.display = "none";
        location_input.style.display = "block";
        location_preview.style.display = "none";
        price_input.style.display = "block";
        price_preview.style.display = "none";
        email_input.style.display = "block";
        email_preview.style.display = "none";
        properties.style.display = null;
        markdown_examples.style.display = null;
    } else {
        content_preview.innerHTML = marked(content_textarea.value);
        content_textarea.style.display = "none";
        content_preview.style.display = "block";
        location_preview.innerHTML = marked.parseInline(location_input.value);
        location_input.style.display = "none";
        location_preview.style.display = "block";
        price_preview.innerHTML = marked.parseInline(price_input.value);
        price_input.style.display = "none";
        price_preview.style.display = "block";
        email_preview.innerHTML = marked.parseInline(email_input.value);
        email_input.style.display = "none";
        email_preview.style.display = "block";
        properties.style.display = workshops[id].texts.propertiesHidden ? "none" : null;
        markdown_examples.style.display = "none";
    }
    workshops[id].buttons.previewToggled = !workshops[id].buttons.previewToggled;
}

function workshop_init(container) {
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
            previewToggled: false,
            newsletterSent: container.querySelector(".edit-newsletter") === undefined
        },
        current: {
            img: imgsrc.substring(imgsrc.lastIndexOf("name=") + 5)
        }
    }
    workshop_updateValues(id);
    const edit_content = container.querySelector(".edit-content");
    edit_content.addEventListener("keyup", (event) => {
        textareaAutoGrow(event.target);
    });
    textareaAutoGrow(edit_content);

    let color = container.querySelector(".input-workshop-color");
    if (color.tagName === "SELECT") {
        let colorchange = () => color.style.backgroundColor = color.value;
        color.addEventListener("change", colorchange);
        colorchange();
    }
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
