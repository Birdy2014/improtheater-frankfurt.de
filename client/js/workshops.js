import { show_confirm_message, show_message, MESSAGE_SUCCESS, MESSAGE_ERROR, show_error, navigate } from "./navigator.js";
import * as request from "./request.js";
import { calcTextColor } from "../../common/color.js";
import { common_marked_options } from "../../common/marked_options.js";
import { timeDateFormat, dateFormat, timeFormat } from "../../common/time.js";

if (window.marked) {
    marked.use(common_marked_options(undefined));
}

class WorkshopEditor {
    constructor(container) {
        this.container = container;
        this.id = container.id.substring(container.id.indexOf("/") + 1);

        this.state = { id: this.id };

        this.bindEvents();
        this.updateFieldValues();
        this.applyInitialState();
    }

    getImgId() {
        const imgsrc = this.container.querySelector(".workshop-image")?.src || "";
        return imgsrc.substring(imgsrc.lastIndexOf("/upload/") + 8);
    }

    setImgId(imageId) {
        this.state.img = imageId
    }

    bindEvents() {
        const image = this.container.querySelector(".workshop-image");
        if (image) {
            image.addEventListener("click", () => this.editImage());
        }

        const saveButton = this.container.querySelector(".edit-save");
        if (saveButton) {
            saveButton.addEventListener("click", () => this.save());
        }

        const editButton = this.container.querySelector(".edit-edit");
        if (editButton) {
            editButton.addEventListener("click", () => this.toggleEdit());
        }

        const publishButton = this.container.querySelector(".edit-publish");
        if (publishButton) {
            publishButton.addEventListener("click", () => this.publish());
        }

        const deleteButton = this.container.querySelector(".edit-delete");
        if (deleteButton) {
            deleteButton.addEventListener("click", () => this.delete());
        }

        const copyButton = this.container.querySelector(".edit-copy");
        if (copyButton) {
            copyButton.addEventListener("click", () => this.copy());
        }

        const sendButton = this.container.querySelector(".edit-send");
        if (sendButton) {
            sendButton.addEventListener("click", () => this.sendNewsletter());
        }

        const previewButton = this.container.querySelector(".edit-preview");
        if (previewButton) {
            previewButton.addEventListener("click", () => this.showNewsletterPreview());
        }

        const sendTestButton = this.container.querySelector(".edit-send-test");
        if (sendTestButton) {
            sendTestButton.addEventListener("click", () => this.sendTestNewsletter());
        }

        const contentField = this.container.querySelector("[data-field=\"content\"]");
        if (contentField) {
            contentField.addEventListener("input", (event) => this.autoGrowTextarea(event.target));
        }

        const colorInput = this.container.querySelector("[data-field=\"color\"]");
        if (colorInput) {
            const defaultButton = this.container.querySelector(".workshop-color-set-default");
            if (defaultButton) {
                defaultButton.addEventListener("click", () => { colorInput.value = "#e65656"; });
            }

            const dominantButton = this.container.querySelector(".workshop-color-set-dominant");
            if (dominantButton) {
                dominantButton.addEventListener("click", async () => {
                    colorInput.value = await this.fetchDominantColor();
                });
            }

            const resetButton = this.container.querySelector(".workshop-color-set-reset");
            if (resetButton) {
                resetButton.addEventListener("click", () => {
                    colorInput.value = this.state.color;
                });
            }
        }
    }

    applyInitialState() {
        this.toggleEdit(false);

        const properties = this.container.querySelector(".workshop-properties");
        if (properties) {
            properties.style.display = this.state.propertiesHidden ? "none" : null;
        }
    }

    getFieldValues() {
        const getValue = (field) => {
            const element = this.container.querySelector(`[data-field="${field}"]`);
            return element ? element.value : null;
        };

        const getCheckbox = (field) => {
            const element = this.container.querySelector(`[data-field="${field}"]`);
            return element ? element.checked : null;
        };

        const dateElement = this.container.querySelector("[data-field=\"date\"]");
        const beginTimeElement = this.container.querySelector("[data-field=\"beginTime\"]");
        const endTimeElement = this.container.querySelector("[data-field=\"endTime\"]");

        const begin = dateElement && beginTimeElement
            ? Math.floor(new Date(dateElement.value + "T" + beginTimeElement.value).getTime() / 1000)
            : 0;
        const end = dateElement && endTimeElement
            ? Math.floor(new Date(dateElement.value + "T" + endTimeElement.value).getTime() / 1000)
            : 0;

        return {
            id: this.id,
            title: getValue("title"),
            content: getValue("content"),
            img: this.getImgId(),
            begin,
            end,
            location: getValue("location"),
            price: getValue("price"),
            email: getValue("email"),
            color: getValue("color"),
            textColor: getValue("textColor"),
            propertiesHidden: getCheckbox("propertiesHidden"),
            type: getValue("type"),
            visible: this.container.querySelector(".edit-publish")?.innerHTML !== "Veröffentlichen",
        };
    }

    updateFieldValues() {
        this.state = this.getFieldValues();
    }

    hasChanges() {
        const current = this.getFieldValues();
        const stored = this.state;

        return Object.keys(current).some(key => {
            if (key === "id") return false;
            if (current[key] === stored[key]) return false;
            if (current[key] == null && stored[key] == null) return false;
            return true;
        });
    }

    isEditMode() {
        return this.container.classList.contains("is-editing");
    }

    toggleEdit(enableEdit = !this.isEditMode()) {
        if (enableEdit) {
            this.container.classList.add("is-editing");
        } else {
            this.renderPreview();
            this.container.classList.remove("is-editing");
        }

        const editButton = this.container.querySelector(".edit-edit");
        if (editButton) {
            editButton.innerHTML = enableEdit ? "Bearbeiten beenden" : "Bearbeiten";
        }

        const image = this.container.querySelector(".workshop-image");
        if (image) {
            image.style.cursor = enableEdit ? "default" : "pointer";
        }

        if (enableEdit) {
            this.autoGrowTextarea(this.container.querySelector("[data-field=\"content\"]"));
        }
    }

    renderPreview() {
        const currentState = this.getFieldValues();

        const titleElement = this.container.querySelector("[data-render=\"title\"]");
        if (titleElement) titleElement.innerHTML = currentState.title;

        const contentElement = this.container.querySelector("[data-render=\"content\"]");
        if (contentElement) contentElement.innerHTML = marked.parse(currentState.content || "");

        const locationElement = this.container.querySelector("[data-render=\"location\"]");
        if (locationElement) locationElement.innerHTML = marked.parseInline(currentState.location || "");

        const priceElement = this.container.querySelector("[data-render=\"price\"]");
        if (priceElement) priceElement.innerHTML = marked.parseInline(currentState.price || "");

        const emailElement = this.container.querySelector("[data-render=\"email\"]");
        if (emailElement) emailElement.innerHTML = marked.parseInline(currentState.email || "");

        const dateElement = this.container.querySelector("[data-render=\"date\"]");
        if (dateElement) dateElement.innerHTML = dateFormat.formatRange(currentState.begin * 1000, currentState.end * 1000);

        const timeElement = this.container.querySelector("[data-render=\"time\"]");
        if (timeElement) timeElement.innerHTML = timeFormat.formatRange(currentState.begin * 1000, currentState.end * 1000);

        const properties = this.container.querySelector(".workshop-properties");
        if (properties) {
            properties.style.display = currentState.propertiesHidden ? "none" : null;
            properties.style.backgroundColor = currentState.color;
            properties.style.color = currentState.textColor || calcTextColor(currentState.color);
        }

        this.breakLinks();
    }

    breakLinks() {
        const content = this.container.querySelector(".workshop-content-preview");
        if (!content) return;

        const links = content.querySelectorAll("a");
        links.forEach(link => {
            link.innerHTML = link.innerHTML.replaceAll("/", "/<wbr>");
        });
    }

    autoGrowTextarea(field) {
        if (field && field.scrollHeight > field.clientHeight) {
            field.style.height = field.scrollHeight + "px";
        }
    }

    async save() {
        this.updateFieldValues();

        try {
            await request.post("/api/workshops", this.state);
            invalidate_workshops_pages();
            show_message(MESSAGE_SUCCESS, "Daten gespeichert");
        } catch (error) {
            if (error.response && error.response.status === 400) {
                show_message(MESSAGE_ERROR, error.response.data);
            } else {
                show_error(error);
            }
        }
    }

    async publish() {
        try {
            const newVisibility = !this.state.visible;
            await request.post("/api/workshops", { id: this.id, visible: newVisibility ? 1 : 0 });

            this.state.visible = newVisibility;

            const button = this.container.querySelector(".edit-publish");
            if (button) {
                button.innerHTML = newVisibility ? "Unsichtbar machen" : "Veröffentlichen";
            }

            invalidate_workshops_pages();
            show_message(MESSAGE_SUCCESS, newVisibility ? "Der Workshop ist jetzt sichtbar" : "Der Workshop ist jetzt nicht mehr sichtbar");
        } catch (error) {
            if (error.response && error.response.status === 400) {
                show_message(MESSAGE_ERROR, error.response.data);
                const button = this.container.querySelector(".edit-publish");
                if (button) button.innerHTML = "Veröffentlichen";
                this.state.visible = false;
            } else {
                show_error(error);
            }
        }
    }

    async delete() {
        if (!await show_confirm_message("Soll der Workshop wirklich gelöscht werden?")) {
            return;
        }

        await request.del("/api/workshops", { id: this.id });
        invalidate_workshops_pages();
        await navigate("workshops", { reload: true });
    }

    async copy() {
        if (!await show_confirm_message("Eine Kopie des Workshops erstellen?")) {
            return;
        }

        const response = await request.post("/api/workshop/copy", { id: this.id });
        const copyId = response.data.id;

        invalidate_workshops_pages();
        await navigate(`workshop/${copyId}`, { reload: true });
        show_message(MESSAGE_SUCCESS, "Workshop kopiert");
    }

    editImage() {
        if (!this.isEditMode()) {
            return;
        }

        window.sessionStorage.setItem("editWorkshop", window.currentRoute);
        navigate("uploads");
    }

    getSelectedWorkshops() {
        const dropdowns = this.container.querySelectorAll(".workshop-attachment-dropdown");
        return [this.id].concat(Array.from(dropdowns)
            .map(dropdown => parseInt(dropdown.value))
            .filter(value => value !== 0));
    }

    showNewsletterPreview() {
        const ids = this.getSelectedWorkshops();
        window.open(`/newsletter-preview?${ids.map(id => `workshops=${id}`).join("&")}`, "_blank");
    }

    async sendNewsletter() {
        try {
            const selectedWorkshops = this.getSelectedWorkshops();

            for (const id of selectedWorkshops) {
                const editor = getWorkshopEditor(id);
                if (editor && editor.hasChanges()) {
                    if (id == this.id) {
                        show_message(MESSAGE_ERROR, "Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.");
                    } else {
                        show_message(MESSAGE_ERROR, `Es gibt ungespeicherte Änderungen in Workshop ${id}. Der Newsletter wurde nicht versendet.`);
                    }
                    return;
                }
            }

            const sendTimeElement = this.container.querySelector(".edit-send-time");
            const sendTime = sendTimeElement?.value
                ? Math.floor(new Date(sendTimeElement.value).getTime() / 1000)
                : 0;

            const sendTimeText = sendTime === 0
                ? "jetzt"
                : `am ${timeDateFormat.format(new Date(sendTime * 1000))}`;

            const confirmMsg = selectedWorkshops.length === 1
                ? `Soll der Newsletter wirklich ${sendTimeText} versendet werden?`
                : `Soll der Newsletter mit folgenden Workshops wirklich ${sendTimeText} versendet werden?\n${selectedWorkshops.join("\n")}`;

            if (!await show_confirm_message(confirmMsg)) {
                return;
            }

            await request.post("/api/newsletter/send", { workshops: selectedWorkshops, sendTime });

            for (const id of selectedWorkshops) {
                const editor = getWorkshopEditor(id);
                if (editor) {
                    const container = document.getElementById("workshop/" + id);
                    if (container) {
                        const sentElement = container.querySelector(".newsletter-sent");
                        if (sentElement) sentElement.innerText = "BEREITS VERSENDET ";
                    }
                }
            }

            show_message(MESSAGE_SUCCESS, "Newsletter gesendet");
        } catch (e) {
            console.error(e);
            if (e.response?.status === 404) {
                show_message(MESSAGE_ERROR, "Der Workshop ist noch nicht öffentlich.", false);
            } else {
                show_error(e);
            }
        }
    }

    async sendTestNewsletter() {
        try {
            const selectedWorkshops = this.getSelectedWorkshops();

            for (const id of selectedWorkshops) {
                const editor = getWorkshopEditor(id);
                if (editor && editor.hasChanges()) {
                    if (id == this.id) {
                        show_message(MESSAGE_ERROR, "Es gibt ungespeicherte Änderungen. Der Newsletter wurde nicht versendet.");
                    } else {
                        show_message(MESSAGE_ERROR, `Es gibt ungespeicherte Änderungen in Workshop ${id}. Der Newsletter wurde nicht versendet.`);
                    }
                    return;
                }
            }

            await request.post("/api/newsletter/send", { workshops: selectedWorkshops, test: true });
            show_message(MESSAGE_SUCCESS, "Testmail gesendet");
        } catch (e) {
            console.error(e);
            show_error(e);
        }
    }

    async fetchDominantColor() {
        const response = await request.get(`/api/upload-color/${this.state.img}`);
        return response.data;
    }

    async createAttachmentDropdown() {
        const container = this.container.querySelector(".workshop-attachments");
        if (!container) return;

        const otherWorkshops = (await request.get("/api/workshops")).data.filter(w => w.id != this.id);

        const workshopsList = [
            { id: 0, title: "Angehängten Newsletter auswählen" },
            ...otherWorkshops
        ];

        const dropdown = document.createElement("select");
        dropdown.classList.add("workshop-attachment-dropdown");
        container.append(dropdown);

        for (const workshop of workshopsList) {
            const option = document.createElement("option");
            option.value = workshop.id;
            option.text = workshop.title;
            dropdown.append(option);
        }

        dropdown.addEventListener("change", () => {
            const allDropdowns = container.querySelectorAll("select");
            if (allDropdowns.values().every(d => d.selectedIndex > 0)) {
                this.createAttachmentDropdown();
            }
        });
    }
}

const editors = new Map();

export function getWorkshopEditor(id) {
    return editors.get(parseInt(id));
}

function invalidate_workshops_pages() {
    document.querySelectorAll(".container[id^='workshops']").forEach(c => c.remove());
}

async function createWorkshop() {
    try {
        const response = await request.post("/api/workshops");
        const id = response.data.id;
        invalidate_workshops_pages();
        await navigate(`workshop/${id}`, { reload: true });
        const editor = getWorkshopEditor(id);
        if (editor) {
            editor.toggleEdit(true);
        }
    } catch(e) {
        show_error(e);
    }
}

window.workshops_init = (container) => {
    container.querySelector("#workshops-add")?.addEventListener("click", _ => createWorkshop());
}

window.workshop_init = (container) => {
    if (!container.querySelector(".workshop-options")) {
        // User is not logged in
        return;
    }

    const id = container.id.substring(container.id.indexOf("/") + 1);
    const editor = new WorkshopEditor(container);
    editors.set(parseInt(id), editor);
    editor.createAttachmentDropdown();
}
