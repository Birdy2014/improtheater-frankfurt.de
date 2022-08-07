async function change_email(event) {
    event.preventDefault();

    const email_field = event.target.querySelector("input[name='change-email']");
    const email = email_field.value;
    try {
        await axios.put("/api/user", { email });
        email_field.placeholder = email;
        email_field.value = "";
        alert(ALERT_SUCCESS, "E-Mail Adresse geändert");
    } catch (err) {
        showError(err);
    }
}

async function change_username(event) {
    event.preventDefault();

    const username_field = event.target.querySelector("input[name='change-username']");
    const username = username_field.value;
    try {
        await axios.put("/api/user", { username });
        username_field.placeholder = username;
        username_field.value = "";
        alert(ALERT_SUCCESS, "Benutzername geändert");
    } catch (err) {
        showError(err);
    }
}

async function change_password(event) {
    event.preventDefault();

    const password_field = event.target.querySelector("input[name='change-password']");
    const password = password_field.value;
    try {
        await axios.put("/api/user", { password });
        password_field.value = "";
        alert(ALERT_SUCCESS, "Passwort geändert");
    } catch (err) {
        showError(err);
    }
}

async function change_user_handler(event) {
    event.preventDefault();

    const id = event.target.querySelector(".id_row").innerText;
    const username_field = event.target.querySelector("input[name='username']");
    const email_field = event.target.querySelector("input[name='email']");
    const password_field = event.target.querySelector("input[name='password']");
    const admin_field = event.target.querySelector("input[name='admin']");

    try {
        await axios.put("/api/user", {
            id,
            username: username_field.value,
            email: email_field.value,
            password: password_field.value,
            admin: admin_field.checked
        });

        if (username_field.value) {
            username_field.placeholder = username_field.value;
            username_field.value = "";
        }
        if (email_field.value) {
            email_field.placeholder = email_field.value;
            email_field.value = "";
        }
        password_field.value = "";
        alert(ALERT_SUCCESS, "Benutzer geändert");
    } catch (err) {
        showError(err);
    }
}

async function create_user_handler(event) {
    event.preventDefault();

    const username_field = event.target.querySelector("input[name='username']");
    const email_field = event.target.querySelector("input[name='email']");
    const password_field = event.target.querySelector("input[name='password']");
    const admin_field = event.target.querySelector("input[name='admin']");

    try {
        await axios.post("/api/user", {
            username: username_field.value,
            email: email_field.value,
            password: password_field.value,
            admin: admin_field.value
        });

        navigate("/user", true, true, false);
        alert(ALERT_SUCCESS, "Benutzer erstellt");
    } catch (err) {
        showError(err);
    }
}

async function delete_user_handler(event) {
    event.preventDefault();

    const id = event.target.parentElement.querySelector(".id_row").innerText;

    try {
        await axios.delete("/api/user", { data: { id } });

        navigate("/user", true, true, false);
        alert(ALERT_SUCCESS, "Benutzer erstellt");
    } catch (err) {
        showError(err);
    }
}

function user_init(container) {
    const email_change_form = container.querySelector("#email-change-form");
    email_change_form.addEventListener("submit", change_email);
    const username_change_form = container.querySelector("#username-change-form");
    username_change_form.addEventListener("submit", change_username);
    const password_change_form = container.querySelector("#password-change-form");
    password_change_form.addEventListener("submit", change_password);

    const user_list = container.querySelector("#user-list");
    if (!user_list)
        return;
    for (const form of user_list.querySelectorAll("form")) {
        form.addEventListener("submit", change_user_handler);
        form.querySelector(".user-delete-button").addEventListener("click", delete_user_handler);
    }

    const user_create_form = container.querySelector("#user-create-form");
    user_create_form.addEventListener("submit", create_user_handler);
}
