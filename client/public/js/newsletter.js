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
        await axios.post("/api/newsletter/subscribe", { email, name, subscribedTo });
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

function newsletter_checkValidity() {
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

const form = document.getElementById("newsletter-form");
form.addEventListener("submit", subscribe);
form.addEventListener("change", newsletter_checkValidity);
