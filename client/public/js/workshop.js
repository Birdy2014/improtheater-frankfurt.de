const workshops = {};

async function changeWorkshopValues() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    workshop_updateValues(id);
    if (typeof editWorkshopItem !== "undefined")
        editWorkshopItem(workshops[id].texts);
    await axios.post("/api/workshops", workshops[id].texts);
    alert("Daten gespeichert");
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
        alert("Der Workshop ist jetzt sichtbar");
    } else {
        button.innerHTML = "Veröffentlichen";
        alert("Der Workshop ist jetzt nicht mehr sichtbar");
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
            alert("Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.");
            return;
        }
        if (workshops[id].texts.color === "#ffffff") {
            alert("Nein Hauke, weiß ist verboten. Der Newsletter wurde nicht versendet. Schöne Grüße Elisa");
            return;
        }
        await axios.post("/api/newsletter/send", { workshop: id });
        workshops[id].buttons.newsletterSent = true;
        container.querySelectorAll(".edit-newsletter").forEach(value => value.style.display = "none");
        alert("Newsletter gesendet");
    } catch (e) {
        console.error(JSON.stringify(e));
        alert("Fehler");
    }
}

function textareaAutoGrow(field) {
    if (field.scrollHeight > field.clientHeight)
        field.style.height = field.scrollHeight + "px";
}

function toggleWorkshopPreview() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let textarea = container.querySelector(".edit-content");
    let preview = container.querySelector(".workshop-content-preview");
    
    if (workshops[id].buttons.previewToggled) {
        textarea.style.display = "block";
        preview.style.display = "none";
    } else {
        preview.innerHTML = marked(textarea.value);
        textarea.style.display = "none";
        preview.style.display = "block";
    }
    workshops[id].buttons.previewToggled = !workshops[id].buttons.previewToggled;
}

function workshop_init() {
    const id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    const container = document.getElementById("workshop/" + id);
    workshops[id] = {
        texts: {
            id
        },
        buttons: {
            published: container.querySelector(".edit-publish").innerHTML !== "Veröffentlichen",
            previewToggled: false,
            newsletterSent: container.querySelector(".edit-newsletter") === undefined
        }
    }
    workshop_updateValues(id);
    const edit_content = container.querySelector(".edit-content");
    edit_content.addEventListener("keyup", (event) => {
        textareaAutoGrow(event.target);
    });
}

function workshop_updateValues(id) {
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    const container = document.getElementById("workshop/" + id);
    workshops[id].texts.title = container.querySelector(".edit-title").value;
    workshops[id].texts.content = container.querySelector(".edit-content").value;
    workshops[id].texts.img = container.querySelector(".workshop-image").src;
    let date = container.querySelector(".input-workshop-date").value;
    let beginTime = container.querySelector(".input-workshop-time-begin").value;
    let endTime = container.querySelector(".input-workshop-time-end").value;
    workshops[id].texts.begin = Date.parse(date + "T" + beginTime) / 1000;
    workshops[id].texts.end = Date.parse(date + "T" + endTime) / 1000;
    workshops[id].texts.location = container.querySelector(".edit-workshop-location").value;
    workshops[id].texts.price = container.querySelector(".edit-workshop-price").value;
    workshops[id].texts.email = container.querySelector(".edit-workshop-email").value;
    workshops[id].texts.color = container.querySelector(".input-workshop-color").value;
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
        workshops[id].texts.img !== container.querySelector(".workshop-image").src ||
        workshops[id].texts.begin !== Date.parse(date + "T" + beginTime) / 1000 ||
        workshops[id].texts.end !== Date.parse(date + "T" + endTime) / 1000 ||
        workshops[id].texts.location !== container.querySelector(".edit-workshop-location").value ||
        workshops[id].texts.price !== container.querySelector(".edit-workshop-price").value ||
        workshops[id].texts.email !== container.querySelector(".edit-workshop-email").value ||
        workshops[id].texts.color !== container.querySelector(".input-workshop-color").value
    )
}
