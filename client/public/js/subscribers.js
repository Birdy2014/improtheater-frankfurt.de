async function subscribers_add(event) {
    event.preventDefault();
    try {
        let email = document.getElementById("subscribers-add-email").value;
        let name = document.getElementById("subscribers-add-name").value;
        let subscribedTo = document.getElementById("subscribers-add-type").value;
        await axios.post("/api/newsletter/add", { email, name, subscribedTo });
        alert(ALERT_SUCCESS, "Abonent hinzugefügt");
        navigate(currentRoute, true, false)
    } catch(err) {
        showError(err);
    }
}

async function subscribers_remove(token, name) {
    try {
        if (!await confirm(`Soll ${name} wirklich vom Newsletter abgemeldet werden?`))
            return;
        await axios.get(`/api/newsletter/unsubscribe?token=${token}`);
        navigate(currentRoute, true, false)
    } catch(err) {
        showError(err);
    }
}

async function subscribers_change_type(event) {
    try {
        const row = event.target.parentNode.parentNode;
        const token = row.id.substring(row.id.lastIndexOf("-") + 1);
        const subscribedTo = event.target.value;
        const name = row.querySelector(".subscribers-name").innerText;
        await axios.post("/api/newsletter/subscribe", { token, subscribedTo, setSubscribed: true });
        alert(ALERT_SUCCESS, `Newsletter für ${name} geändert.`);
    } catch(err) {
        showError(err);
    }
}

function subscribers_init(container) {
    const form = container.querySelector("#subscribers-add");
    form.addEventListener("submit", subscribers_add);

    for (const select of container.querySelectorAll(".subscribers-subscribedTo")) {
        select.addEventListener("change", subscribers_change_type);
    }
}
