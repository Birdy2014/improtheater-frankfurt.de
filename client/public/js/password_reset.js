async function reset_password(event, token) {
    event.preventDefault();

    const password_field = event.target.querySelector("input[name='reset-password']");
    const password = password_field.value;
    try {
        await axios.post("/api/user/password_reset", { token, password });
        password_field.value = "";
        show_message(MESSAGE_SUCCESS, "Passwort geändert");
    } catch (err) {
        showError(err);
    }
}

function password_reset_init(container, query) {
    const search_params = new URLSearchParams(query);

    if (!search_params.has("token")) {
        show_message(MESSAGE_ERROR, "token fehlt :(", false);
        return;
    }

    const token = search_params.get("token");

    const form = container.querySelector("#password-reset-form");
    form.addEventListener("submit", event => reset_password(event, token));
}
