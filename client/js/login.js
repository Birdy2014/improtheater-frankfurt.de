import { show_message, MESSAGE_ERROR, show_error } from "./navigator.js";
import * as request from "./request.js";

async function login(event, route) {
    event.preventDefault();

    const login = event.target.querySelector("input[name='login']").value;
    const password = event.target.querySelector("input[name='password']").value;

    try {
        await request.post("/api/login", { login, password });
        location.href = route;
    } catch (err) {
        if (err.response.status === 403) {
            show_message(MESSAGE_ERROR, "Falscher Benutzername oder Passwort", false);
        } else {
            show_error(err);
        }
    }
}

async function request_password_reset(form) {
    const login = form.querySelector("input[name='login']").value;
    if (!login) {
        show_message(MESSAGE_ERROR, "Benutzername/E-Mail-Adresse fehlt");
        return;
    }

    try {
        await request.post("/api/user/request_password_reset", { login });
    } catch (err) {
        if (err.response.status === 404) {
            show_message(MESSAGE_ERROR, "Ungültiger Benutzername oder E-Mail-Adresse");
        } else {
            show_error(err);
        }
    }
}

window.login_init = (container, query) => {
    const search_params = new URLSearchParams(query);
    const route = search_params.get("route") || "/start";

    const login_form = container.querySelector("#login-form");
    login_form.addEventListener("submit", event => login(event, route));
    const password_reset_link = container.querySelector("#password-reset-link");
    password_reset_link.addEventListener("click", _ => request_password_reset(login_form));
}
