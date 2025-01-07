import { navigate, show_error, show_confirm_message, show_message, MESSAGE_SUCCESS } from "./navigator.js";

async function subscribers_add(event) {
    event.preventDefault();
    try {
        let email = document.getElementById("subscribers-add-email").value;
        let name = document.getElementById("subscribers-add-name").value;
        let subscribedTo = document.getElementById("subscribers-add-type").value;
        await axios.post("/api/newsletter/add", { email, name, subscribedTo });
        show_message(MESSAGE_SUCCESS, "Abonent hinzugefügt");
        navigate(currentRoute, { reload: true, push_history: false })
    } catch(err) {
        show_error(err);
    }
}

async function subscribers_remove(token, name) {
    try {
        if (!await show_confirm_message(`Soll ${name} wirklich vom Newsletter abgemeldet werden?`))
            return;
        await axios.post("/api/newsletter/unsubscribe", { token });
        document.querySelector(`#subscriber-${token}`).remove();
        show_message(MESSAGE_SUCCESS, `${name} wurde entfernt.`);
    } catch(err) {
        show_error(err);
    }
}

async function subscribers_change_type(event) {
    try {
        const row = event.target.parentNode.parentNode;
        const token = row.id.substring(row.id.lastIndexOf("-") + 1);
        const subscribedTo = event.target.value;
        const name = row.querySelector(".subscribers-name").innerText;
        await axios.post("/api/newsletter/subscribe", { token, subscribedTo });
        show_message(MESSAGE_SUCCESS, `Newsletter für ${name} geändert.`);
    } catch(err) {
        show_error(err);
    }
}

window.subscribers_init = (container) => {
    const form = container.querySelector("#subscribers-add");
    form.addEventListener("submit", subscribers_add);

    for (const select of container.querySelectorAll(".subscribers-subscribedTo")) {
        select.addEventListener("change", subscribers_change_type);
    }

    container.querySelectorAll(".subscribers-delete > a").forEach(element => element.addEventListener("click", _ => {
        subscribers_remove(element.dataset.token, element.dataset.name);
    }));
}
