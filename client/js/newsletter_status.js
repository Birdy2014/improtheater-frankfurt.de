import { show_confirm_message } from "./navigator.js";
import * as request from "./request.js";
import { timeDateFormat, getCurrentTimestamp } from "../../common/time.js";

window.newsletter_status_init = (container, query) => {
    update_status();
}

const newsletter_elements = {};

function newsletter_id_string(newsletter) {
    return newsletter.workshops.map(w => w.id).join("-");
}

async function update_status() {
    const response = await request.get("/api/newsletter/status");
    for (const newsletter of response.data) {
        const id = newsletter_id_string(newsletter);
        let element = newsletter_elements[id];
        if (!element) {
            const fragment = document.importNode(document.querySelector("#template-newsletter-status-item").content, true);

            const preview_link = fragment.querySelector(".preview-link");
            preview_link.innerText = newsletter.workshops.map(w => w.title).join(", ");
            preview_link.href = `/newsletter-preview?${newsletter.workshops.map(w => `workshops=${w.id}`).join("&")}`;

            const delete_icon = fragment.querySelector(".icon-delete");
            delete_icon.addEventListener("click", async event => {
                if (await show_confirm_message("Soll das Senden dieses Newsletters wirklich abgebrochen werden?")) {
                    request.post("/api/newsletter/cancel", { workshops: newsletter.workshops.map(w => w.id) })
                }
            });

            newsletter_elements[id] = element = fragment.firstElementChild;
            document.querySelector("#newsletter-status-list").appendChild(fragment);
        }
        update_element(element, newsletter);
    }

    for (const newsletter_id in newsletter_elements) {
        if (!response.data.some(newsletter => newsletter_id_string(newsletter) === newsletter_id)) {
            newsletter_elements[newsletter_id].remove();
        }
    }

    setTimeout(update_status, 2000);
}

function update_element(element, status) {
    const sent = status.recipientsAmount - status.recipientsLeft;
    element.querySelector(".progress-indicator").innerText = `${sent}/${status.recipientsAmount}`;

    const progress_bar = element.querySelector(".progress-bar");
    progress_bar.max = status.recipientsAmount;
    progress_bar.value = sent;

    element.querySelector(".newsletter-status-text").innerText = status.sendTime < getCurrentTimestamp() ? "Wird versendet" : `Wird am ${timeDateFormat.format(status.sendTime * 1000)} versendet`;
}
