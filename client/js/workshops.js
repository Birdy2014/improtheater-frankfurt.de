import { show_confirm_message, show_message, MESSAGE_SUCCESS, MESSAGE_ERROR, show_error, navigate } from "./navigator.js";
import * as request from "./request.js";
import { calcTextColor } from "../../common/color.js";

export const workshops = {};
const dateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const timeFormat = Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });

if (window.marked) {
    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false,
    });
}

async function createWorkshop() {
    try {
        let response = await request.post("/api/workshops");
        let id = response.data.id;
        invalidate_workshops_pages();
        await navigate(`workshop/${id}`, { reload: true });
        toggleWorkshopPreview();
    } catch(e) {
        show_error(e);
    }
}

function invalidate_workshops_pages() {
    document.querySelectorAll(".container[id^='workshops']").forEach(container => container.remove());
}

window.workshops_init = (container) => {
    container.querySelector("#workshops-add")?.addEventListener("click", _ => createWorkshop());
}

function get_current_workshop_id() {
    const id_string = currentRoute.substring(currentRoute.indexOf("/") + 1);
    const id = parseInt(id_string, 10);
    if (isNaN(id)) {
        show_message(MESSAGE_ERROR, `Nonsense workshop id '${id_string}'`);
        return undefined;
    }
    return id;
}

async function changeWorkshopValues() {
    const id = get_current_workshop_id();
    workshop_updateValues(id);
    invalidate_workshops_pages();
    try {
        await request.post("/api/workshops", workshops[id].texts);
        show_message(MESSAGE_SUCCESS, "Daten gespeichert");
    } catch(error) {
        if (error.response && error.response.status === 400) {
            show_message(MESSAGE_ERROR, error.response.data);
        } else {
            show_error(error);
        }
    }
}

async function publishWorkshop() {
    const id = get_current_workshop_id();
    let container = document.getElementById(currentRoute);
    let button = container.getElementsByClassName("edit-publish")[0];

    try {
        await request.post("/api/workshops", { id, visible: workshops[id].buttons.published ? 0 : 1 });

        workshops[id].buttons.published = !workshops[id].buttons.published;
        invalidate_workshops_pages();

        if (workshops[id].buttons.published) {
            button.innerHTML = "Unsichtbar machen";
            show_message(MESSAGE_SUCCESS, "Der Workshop ist jetzt sichtbar");
        } else {
            button.innerHTML = "Veröffentlichen";
            show_message(MESSAGE_SUCCESS, "Der Workshop ist jetzt nicht mehr sichtbar");
        }
    } catch(error) {
        if (error.response && error.response.status === 400) {
            show_message(MESSAGE_ERROR, error.response.data);
            button.innerHTML = "Veröffentlichen";
            workshops[id].buttons.published = false;
        } else {
            show_error(error);
        }
    }
}

async function deleteWorkshop(id) {
    if (!await show_confirm_message("Soll der Newsletter wirklich gelöscht werden?"))
        return;
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    await request.del("/api/workshops", { id });
    invalidate_workshops_pages();
    await navigate("workshops", { reload: true });
}

async function copyWorkshop() {
    if (!await show_confirm_message("Eine Kopie des Workshops erstellen?"))
        return;

    const id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    const response = await request.post("/api/workshop/copy", { id });
    const copy_id = response.data.id;

    invalidate_workshops_pages();
    await navigate(`workshop/${copy_id}`, { reload: true });
    show_message(MESSAGE_SUCCESS, "Workshop Kopiert");
}

function editWorkshopImage() {
    const id = get_current_workshop_id();
    if (workshops[id].buttons.previewToggled) {
        return;
    }
    window.sessionStorage.setItem("editWorkshop", currentRoute);
    navigate("uploads");
}

function get_marked_newsletters() {
    const workshop_id = get_current_workshop_id();
    const container = document.getElementById("workshop/" + workshop_id);
    const workshop_attachment_dropdowns = container.querySelectorAll(".workshop-attachment-dropdown");

    const marked_newsletters = [workshop_id];
    for (const workshop_attachment_dropdown of workshop_attachment_dropdowns) {
        const value = parseInt(workshop_attachment_dropdown.value);
        if (value === 0) {
            continue;
        }
        marked_newsletters.push(value);
    }

    return marked_newsletters;
}

async function create_workshop_attachment_dropdown()  {
    const workshop_id = get_current_workshop_id();
    const container = document.getElementById("workshop/" + workshop_id);
    const workshop_attachments_container = container.querySelector(".workshop-attachments");

    if (!workshop_attachments_container) {
        return;
    }

    const workshops_list = [
        { id: 0, title: "Angehängten Newsletter auswählen" },
        ...(await request.get("/api/workshops")).data
    ];

    const workshop_attachment_dropdown = document.createElement("select");
    workshop_attachment_dropdown.classList.add("workshop-attachment-dropdown");
    workshop_attachments_container.append(workshop_attachment_dropdown);
    for (const workshop of workshops_list) {
        const option = document.createElement("option");
        option.value = workshop.id;
        option.text = workshop.title;
        workshop_attachment_dropdown.append(option);
    }
}

function showNewsletterPreview() {
    window.open(`/newsletter-preview?${get_marked_newsletters().map(id => `workshops=${id}`).join("&")}`, "_blank");
}

async function sendNewsletter() {
    try {
        const current_workshop = get_current_workshop_id();

        const marked_newsletters = get_marked_newsletters();
        for (const marked_newsletter_id of marked_newsletters) {
            if (workshop_changed(marked_newsletter_id)) {
                if (marked_newsletter_id == current_workshop) {
                    show_message(MESSAGE_ERROR, `Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.`);
                } else {
                    show_message(MESSAGE_ERROR, `Es gibt ungespeicherte Änderungen in Workshop ${marked_newsletter_id}. Der Newsletter wurde nicht versendet.`);
                }
                return;
            }
        }

        if (marked_newsletters.length === 1) {
            if (!await show_confirm_message("Soll der Newsletter wirklich so versendet werden?"))
                return;
        } else {
            if (!await show_confirm_message(`Soll der Newsletter mit folgenden Workshops wirklich so versendet werden?\n${marked_newsletters.join("\n")}`))
                return;
        }

        await request.post("/api/newsletter/send", { workshops: marked_newsletters });
        for (const marked_newsletter_id of marked_newsletters) {
            if (workshops[marked_newsletter_id] === undefined)
                continue

            workshops[marked_newsletter_id].buttons.newsletterSent = true;
            const container = document.getElementById("workshop/" + marked_newsletter_id);
            if (container) {
                // TODO: Only do this if the user is not allowed to resend newsletters
                container.querySelectorAll(".edit-newsletter").forEach(value => value.style.display = "none");
            }
        }
        sessionStorage.removeItem("marked_newsletters");
        show_message(MESSAGE_SUCCESS, "Newsletter gesendet");
    } catch (e) {
        console.error(e);
        if (e.response.status === 404)
            show_message(MESSAGE_ERROR, "Der Workshop ist noch nicht öffentlich.", false);
        else
            show_error(e);
    }
}

async function sendTestNewsletter() {
    try {
        const current_workshop = get_current_workshop_id();

        const marked_newsletters = get_marked_newsletters();

        for (const marked_newsletter_id of marked_newsletters) {
            if (workshop_changed(marked_newsletter_id)) {
                if (marked_newsletter_id == current_workshop) {
                    show_message(MESSAGE_ERROR, `Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.`);
                } else {
                    show_message(MESSAGE_ERROR, `Es gibt ungespeicherte Änderungen in Workshop ${marked_newsletter_id}. Der Newsletter wurde nicht versendet.`);
                }
                return;
            }
        }

        await request.post("/api/newsletter/send", { workshops: marked_newsletters, test: true });
        show_message(MESSAGE_SUCCESS, "Testmail gesendet");
    } catch (e) {
        console.error(e);
        show_error(e);
    }
}

function textareaAutoGrow(field) {
    if (field.scrollHeight > field.clientHeight)
        field.style.height = field.scrollHeight + "px";
}

function toggleWorkshopPreview() {
    const id = get_current_workshop_id();
    let container = document.getElementById(currentRoute);
    let title_preview = container.querySelector(".workshop-title");
    let content_preview = container.querySelector(".workshop-content-preview");
    let location_preview = container.querySelector(".workshop-location");
    let price_preview = container.querySelector(".workshop-price");
    let email_preview = container.querySelector(".workshop-email");
    let date_preview = container.querySelector(".workshop-date");
    let time_preview = container.querySelector(".workshop-time");
    let properties = container.querySelector(".workshop-properties");
    let preview_button = container.querySelector(".edit-edit");
    let image = container.querySelector(".workshop-image");

    let workshop_edit_fields = container.querySelectorAll(".workshop-edit-field");
    let workshop_preview_fields = container.querySelectorAll(".workshop-preview-field");

    if (workshops[id].buttons.previewToggled) {
        properties.style.display = null;
        properties.style.backgroundColor = null;
        properties.style.color = null;
        preview_button.innerHTML = "Bearbeiten beenden";
        image.style.cursor = "pointer";

        workshop_edit_fields.forEach(element => element.style.display = "block");
        workshop_preview_fields.forEach(element => element.style.display = "none");
        textareaAutoGrow(container.querySelector(".edit-content"));
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
        properties.style.color = calcTextColor(workshops[id].texts.color);
        preview_button.innerHTML = "Bearbeiten";
        image.style.cursor = "default";

        workshop_edit_fields.forEach(element => element.style.display = "none");
        workshop_preview_fields.forEach(element => element.style.display = "block");
    }
    workshops[id].buttons.previewToggled = !workshops[id].buttons.previewToggled;
}

window.workshop_init = (container) => {
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
            img: imgsrc.substring(imgsrc.lastIndexOf("/upload/") + 8)
        }
    }
    workshop_updateValues(id);

    container.querySelector(".workshop-image").addEventListener("click", _ => editWorkshopImage());
    container.querySelector(".edit-save").addEventListener("click", _ => changeWorkshopValues());
    container.querySelector(".edit-edit").addEventListener("click", _ => toggleWorkshopPreview());
    container.querySelector(".edit-publish").addEventListener("click", _ => publishWorkshop());
    container.querySelector(".edit-delete").addEventListener("click", _ => deleteWorkshop());
    container.querySelector(".edit-copy").addEventListener("click", _ => copyWorkshop());
    container.querySelector(".edit-send").addEventListener("click", _ => sendNewsletter());
    container.querySelector(".edit-preview").addEventListener("click", _ => showNewsletterPreview());
    container.querySelector(".edit-send-test").addEventListener("click", _ => sendTestNewsletter());

    const properties = container.querySelector(".workshop-properties");
    properties.style.display = workshops[id].texts.propertiesHidden ? "none" : null;

    const edit_content = container.querySelector(".edit-content");
    edit_content.addEventListener("keyup", (event) => {
        textareaAutoGrow(event.target);
    });

    const color_input = container.querySelector(".input-workshop-color");
    container.querySelector(".workshop-color-set-default").addEventListener("click", () => {
        color_input.value = "#e65656";
    });

    container.querySelector(".workshop-color-set-dominant").addEventListener("click", async () => {
        const response = await request.get(`/api/upload-color/${workshops[id].current.img}`);
        color_input.value = response.data;
    });

    container.querySelector(".workshop-color-set-reset").addEventListener("click", async () => {
        color_input.value = workshops[id].texts.color;
    });

    create_workshop_attachment_dropdown();
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
    if (!id) id = get_current_workshop_id();
    const container = document.getElementById("workshop/" + id);
    if (!container)
        return false;
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

function workshop_break_links(container) {
    const content = container.querySelector(".workshop-content-preview");
    const links = content.querySelectorAll("a");

    links.forEach(link => {
        link.innerHTML = link.innerHTML.replaceAll("/", "/<wbr>");
    });
}
