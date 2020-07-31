async function subscribe(event) {
    event.preventDefault();
    try {
        let email = document.getElementById("input-newsletter-email").value;
        let name = document.getElementById("input-newsletter-name").value;
        await axios.post("/api/newsletter/subscribe", { email, name });
        document.getElementById("text-email-address").innerText = email;
        document.getElementById("newsletter-subscribe").style.display = "none";
        document.getElementById("newsletter-subscribe-success").style.removeProperty("display");
    } catch(e) {
        document.getElementById("newsletter-subscribe").style.display = "none";
        if (e.response && e.response.status === 409) {
            document.getElementById("newsletter-subscribe-failed").style.removeProperty("display");
        } else {
            document.getElementById("newsletter-subscribe-error").style.removeProperty("display");
            console.log(JSON.stringify(e));
        }
    }
}

const form = document.getElementById("newsletter-form");
form.addEventListener("submit", subscribe);