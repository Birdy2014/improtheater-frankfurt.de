let hygienekonzept_previewToggled = false;

async function hygienekonzept_save() {
    try {
        let textarea = window["hygienekonzept-src"].querySelector("textarea");
        await axios.post("/api/hygienekonzept", { content: textarea.value });
        show_message(MESSAGE_SUCCESS, "Hygienekonzept gespeichert");
    } catch(e) {
        showError(e);
    }
}

function hygienekonzept_togglePreview() {
    if (hygienekonzept_previewToggled) {
        window["hygienekonzept-src"].style.display = "block";
        window["hygienekonzept-preview"].style.display = "none";
    } else {
        window["hygienekonzept-preview"].innerHTML = marked.parse(window["hygienekonzept-src"].querySelector("textarea").value);
        window["hygienekonzept-src"].style.display = "none";
        window["hygienekonzept-preview"].style.display = "block";
    }
    hygienekonzept_previewToggled = !hygienekonzept_previewToggled;
}

function textareaAutoGrow(field) {
    if (field.scrollHeight > field.clientHeight)
        field.style.height = field.scrollHeight + "px";
}

function hygienekonzept_init(container, query) {
    let textarea = window["hygienekonzept-src"]?.querySelector("textarea");
    if (textarea) {
        textareaAutoGrow(textarea);
        textarea.addEventListener("keyup", (event) => {
            textareaAutoGrow(event.target);
        });
    } else {
        let searchParams = new URLSearchParams(query);
        if (searchParams.has("scroll") && document.querySelector("#" + searchParams.get("scroll"))) {
            window.scrollTo(0, document.querySelector("#" + searchParams.get("scroll")).offsetTop);
        }
    }
}
