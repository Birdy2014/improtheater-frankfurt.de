let subscribers_form;

async function subscribers_add(event) {
    event.preventDefault();
    try {
        let email = document.getElementById("subscribers-add-email").value;
        let name = document.getElementById("subscribers-add-name").value;
        await axios.post("/api/newsletter/add", { email, name });
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

function subscribers_init(container) {
    subscribers_form = container.querySelector("#subscribers-add");
    subscribers_form.addEventListener("submit", subscribers_add);
}
