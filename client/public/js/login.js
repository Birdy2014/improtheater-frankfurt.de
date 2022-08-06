async function login(event, route) {
    event.preventDefault();

    const login = event.target.querySelector("input[name='login']").value;
    const password = event.target.querySelector("input[name='password']").value;

    try {
        await axios.post("/api/login", { login, password });
        location.href = route;
    } catch (err) {
        if (err.response.status === 403) {
            alert(ALERT_ERROR, "Falscher Benutzername oder Passwort", false);
        } else {
            showError(err);
        }
    }
}

async function request_password_reset(form) {
    const login = form.querySelector("input[name='login']").value;
    if (!login) {
        alert(ALERT_ERROR, "Benutzername/E-Mail-Adresse fehlt");
        return;
    }

    try {
        await axios.post("/api/user/request_password_reset", { login });
    } catch (err) {
        if (err.response.status === 404) {
            alert(ALERT_ERROR, "Ungültiger Benutzername oder E-Mail-Adresse");
        } else {
            showError(err);
        }
    }
}

function login_init(container, query) {
    const search_params = new URLSearchParams(query);
    const route = search_params.get("route") || "/start";

    const login_form = container.querySelector("#login-form");
    login_form.addEventListener("submit", event => login(event, route));
    const password_reset_link = container.querySelector("#password-reset-link");
    password_reset_link.addEventListener("click", event => request_password_reset(login_form));
}
