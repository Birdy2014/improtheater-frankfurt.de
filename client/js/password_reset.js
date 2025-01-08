import { show_message, MESSAGE_SUCCESS, MESSAGE_ERROR, show_error } from "./navigator.js";
import * as request from "./request.js";

async function reset_password(event, token) {
    event.preventDefault();

    const password_field = event.target.querySelector("input[name='reset-password']");
    const password = password_field.value;
    try {
        await request.post("/api/user/password_reset", { token, password });
        password_field.value = "";
        show_message(MESSAGE_SUCCESS, "Passwort geändert");
    } catch (err) {
        show_error(err);
    }
}

window.password_reset_init = (container, query) => {
    const search_params = new URLSearchParams(query);

    if (!search_params.has("token")) {
        show_message(MESSAGE_ERROR, "token fehlt :(", false);
        return;
    }

    const token = search_params.get("token");

    const form = container.querySelector("#password-reset-form");
    form.addEventListener("submit", event => reset_password(event, token));
}
