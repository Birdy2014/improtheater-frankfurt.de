async function login(event) {
    event.preventDefault();

    const login = event.target.querySelector("input[name='login']").value;
    const password = event.target.querySelector("input[name='password']").value;

    try {
        await axios.post("/api/login", { login, password });
        location.href = "/start"; // TODO: go to last visited page if available
    } catch (err) {
        if (err.response.status === 403) {
            alert(ALERT_ERROR, "Falscher Benutzername oder Passwort", false);
        } else {
            showError(err);
        }
    }
}

const login_form = document.querySelector("#login-form");
login_form.addEventListener("submit", login);
