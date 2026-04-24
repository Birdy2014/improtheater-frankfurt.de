import { show_confirm_message } from "./navigator.js";
import * as request from "./request.js";
import { timeDateFormat } from "../../common/time.js";

window.newsletter_status_init = (container, query) => {
    update_status();
};

function newsletter_id_string(newsletter) {
    return newsletter.workshops.map(w => w.id).join("-");
}

async function update_status() {
    let newsletters = [];
    try {
        const response = await request.get("/api/newsletter/status");
        newsletters = response.data;
    } catch (error) {
        setTimeout(update_status, 4000);
        return;
    }

    const container = document.querySelector("#newsletter-status-list");
    const currentIds = new Set(newsletters.map(n => newsletter_id_string(n)));

    container.querySelectorAll(".newsletter-status-item").forEach(element => {
        const id = element.dataset.id;

        if (!currentIds.has(id)) {
            element.remove();
            return;
        }

        const newsletter = newsletters.find(n => newsletter_id_string(n) === id);
        const expectedTemplateId = newsletter.itemType === "pending_newsletter"
            ? "#template-pending-newsletter-status-item"
            : "#template-newsletter-status-item";
        const currentTemplateId = element.dataset.template;

        if (currentTemplateId !== expectedTemplateId) {
            element.replaceWith(create_element(newsletter));
        } else {
            update_element(element, newsletter);
        }
    });

    for (const newsletter of newsletters) {
        const id = newsletter_id_string(newsletter);
        if (!container.querySelector(`[data-id="${id}"]`)) {
            container.appendChild(create_element(newsletter));
        }
    }

    setTimeout(update_status, 2000);
}

function create_element(newsletter) {
    const isPending = newsletter.itemType === "pending_newsletter";
    const templateId = isPending ? "#template-pending-newsletter-status-item" : "#template-newsletter-status-item";
    const fragment = document.importNode(document.querySelector(templateId).content, true);
    const element = fragment.firstElementChild;
    element.dataset.id = newsletter_id_string(newsletter);
    element.dataset.template = templateId;

    const preview_link = element.querySelector(".preview-link");
    preview_link.innerText = newsletter.workshops.map(w => w.title).join(", ");
    preview_link.href = `/newsletter-preview?${newsletter.workshops.map(w => `workshops=${w.id}`).join("&")}`;

    const delete_icon = element.querySelector(".icon-delete");
    delete_icon.addEventListener("click", async event => {
        if (await show_confirm_message("Soll das Senden dieses Newsletters wirklich abgebrochen werden?")) {
            request.post("/api/newsletter/cancel", { workshops: newsletter.workshops.map(w => w.id) })
        }
    });

    update_element(element, newsletter);
    return element;
}

function update_element(element, newsletter) {
    if (newsletter.itemType === "pending_newsletter") {
        element.querySelector(".newsletter-status-text").innerText = `Wird am ${timeDateFormat.format(newsletter.sendTime * 1000)} versendet`;
    } else {
        const sent = newsletter.recipientsAmount - newsletter.recipientsLeft;
        element.querySelector(".progress-indicator").innerText = `${sent}/${newsletter.recipientsAmount}`;

        const progress_bar = element.querySelector(".progress-bar");
        progress_bar.max = newsletter.recipientsAmount;
        progress_bar.value = sent;
    }
}
