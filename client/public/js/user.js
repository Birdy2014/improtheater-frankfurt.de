async function change_password(event) {
    event.preventDefault();

    const password_field = event.target.querySelector("input[name='change-password']");
    const password = password_field.value;
    try {
        await axios.post("/api/user", { password });
        password_field.value = "";
        alert(ALERT_SUCCESS, "Passwort geändert");
    } catch (err) {
        showError(err);
    }
}

function user_init(container) {
    const form = container.querySelector("#password-change-form");
    form.addEventListener("submit", change_password);
}
