import * as request from "./request.js";

async function subscribe(event) {
    event.preventDefault();
    try {
        // Check Checkboxes
        const checkbox_id_prefix = "input-newsletter-";
        let checkboxes = document.querySelectorAll("input[type='checkbox']");
        let subscribedTo = 0;
        for (const checkbox of checkboxes) {
            if (checkbox.checked && checkbox.id.startsWith(checkbox_id_prefix)) {
                subscribedTo |= 1 << parseInt(checkbox.id.substring(checkbox_id_prefix.length));
            }
        }
        if (subscribedTo == 0) {
            return;
        }
        // Send request
        let email = document.getElementById("input-newsletter-email").value;
        let name = document.getElementById("input-newsletter-name").value;
        await request.post("/api/newsletter/subscribe", { email, name, subscribedTo });
        document.getElementById("text-email-address").innerText = email;
        document.getElementById("newsletter-subscribe").style.display = "none";
        document.getElementById("newsletter-subscribe-success").style.removeProperty("display");
    } catch(e) {
        document.getElementById("newsletter-subscribe").style.display = "none";
        if (e.response && e.response.status === 409) {
            document.getElementById("newsletter-subscribe-failed").style.removeProperty("display");
        } else {
            document.getElementById("newsletter-subscribe-error").style.removeProperty("display");
            console.log(JSON.stringify(e));
        }
    }
}

function check_validity() {
    const checkbox_id_prefix = "input-newsletter-";
    let checkboxes = document.querySelectorAll("input[type='checkbox']");
    let valid = false;
    for (const checkbox of checkboxes) {
        if (checkbox.checked && checkbox.id.startsWith(checkbox_id_prefix)) {
            valid = true;
            break;
        }
    }
    checkboxes[0].setCustomValidity(valid ? "" : "Es muss mindestens ein Newsletter ausgewählt sein.");
}

async function unsubscribe(event) {
    event.preventDefault();
    try {
        // Check Checkboxes
        const checkbox_id_prefix = "input-newsletter-";
        let checkboxes = document.querySelectorAll("input[type='checkbox']");
        let type = 0;
        for (const checkbox of checkboxes) {
            if (checkbox.checked && checkbox.id.startsWith(checkbox_id_prefix)) {
                type |= 1 << parseInt(checkbox.id.substring(checkbox_id_prefix.length));
            }
        }
        if (type == 0) {
            return;
        }
        // Send request
        const token = document.getElementById("newsletter-subscriber-token").innerText;
        await request.post("/api/newsletter/unsubscribe", { token, type });
        document.getElementById("newsletter-unsubscribe").style.display = "none";
        document.getElementById("newsletter-unsubscribe-success").style.removeProperty("display");
    } catch(e) {
        document.getElementById("newsletter-unsubscribe").style.display = "none";
        if (e.response && e.response.status === 404) {
            document.getElementById("newsletter-unsubscribe-failed").style.removeProperty("display");
        } else {
            document.getElementById("newsletter-unsubscribe-error").style.removeProperty("display");
            console.log(JSON.stringify(e));
        }
    }
}

async function subscribe_additional() {
    try {
        const token = document.getElementById("newsletter-subscriber-token").innerText;
        await request.post("/api/newsletter/subscribe", { token, subscribedTo: 3 });
        document.getElementById("newsletter-subscribe-additional").style.display = "none";
        document.getElementById("newsletter-subscribe-additional-success").style.removeProperty("display");
    } catch(e) {
        document.getElementById("newsletter-subscribe-additional").style.display = "none";
        document.getElementById("newsletter-subscribe-additional-error").style.removeProperty("display");
    }
}

async function confirm() {
    try {
        const token = document.getElementById("newsletter-subscriber-token").innerText;
        await request.post("/api/newsletter/confirm", { token });
        document.getElementById("newsletter-confirm").style.display = "none";
        document.getElementById("newsletter-confirm-success").style.removeProperty("display");
    } catch(e) {
        console.log(e)
        document.getElementById("newsletter-confirm").style.display = "none";
        document.getElementById("newsletter-confirm-error").style.removeProperty("display");
    }
}

window.newsletter_init = () => {
    const subscribe_form = document.getElementById("newsletter-form");
    if (subscribe_form) {
        subscribe_form.addEventListener("submit", subscribe);
        subscribe_form.addEventListener("change", check_validity);
        check_validity();
    }

    const unsubscribe_form = document.getElementById("newsletter-unsubscribe-form");
    if (unsubscribe_form) {
        unsubscribe_form.addEventListener("submit", unsubscribe);
        unsubscribe_form.addEventListener("change", check_validity);
        check_validity();
    }

    const confirm_subscribe_additional = document.getElementById("input-newsletter-subscribe-additional-confirm");
    if (confirm_subscribe_additional) {
        confirm_subscribe_additional.addEventListener("click", _ => subscribe_additional());
    }

    const confirm_button = document.getElementById("input-newsletter-confirm");
    if (confirm_button) {
        confirm_button.addEventListener("click", _ => confirm())
    }
}
