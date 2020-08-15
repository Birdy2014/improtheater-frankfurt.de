async function changeWorkshopValues() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let title = container.getElementsByClassName("edit-title")[0].innerHTML;
    let content = container.getElementsByClassName("edit-content")[0].innerHTML;
    let img = container.getElementsByClassName("workshop-image")[0].src;
    let date = container.getElementsByClassName("input-workshop-date")[0].value;
    let beginTime = container.getElementsByClassName("input-workshop-time-begin")[0].value;
    let endTime = container.getElementsByClassName("input-workshop-time-end")[0].value;
    let begin = Date.parse(date + "T" + beginTime) / 1000;
    let end = Date.parse(date + "T" + endTime) / 1000;
    let location = container.getElementsByClassName("edit-workshop-location")[0].innerHTML;
    let price = container.getElementsByClassName("edit-workshop-price")[0].innerHTML;
    let email = container.getElementsByClassName("edit-workshop-email")[0].innerHTML;
    await axios.put("/api/workshops", { id, title, content, img, begin, end, location, price, email });
    await navigate(currentRoute, true);
    await navigate("workshops", true, true, true);
    alert("Daten gespeichert");
}

async function publishWorkshop() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let button = container.getElementsByClassName("edit-publish")[0];
    if (button.innerHTML === "Veröffentlichen") {
        await axios.put("/api/workshops", { id, visible: true });
        button.innerHTML = "Unsichtbar machen";
        alert("Der Workshop ist jetzt sichtbar");
    } else {
        await axios.put("/api/workshops", { id, visible: false });
        button.innerHTML = "Veröffentlichen";
        alert("Der Workshop ist jetzt nicht mehr sichtbar");
    }
}

async function deleteWorkshop(id) {
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    await axios.delete("/api/workshops", {
        data: { id }
    });
    await navigate("workshops", true);
}

function editWorkshopImage() {
    window.sessionStorage.setItem("editWorkshop", currentRoute);
    navigate("uploads");
}
