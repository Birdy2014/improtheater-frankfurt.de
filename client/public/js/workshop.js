async function changeWorkshopValues() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let title = container.getElementsByClassName("edit-title")[0].innerHTML;
    let content = container.getElementsByClassName("edit-content")[0].innerHTML;
    await axios.put("/api/workshops", { id, title, content });
    await navigate(currentRoute, true);
    alert("Daten gespeichert");
}

async function publishWorkshop() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    await axios.put("/api/workshops", { id, visible: true });
    alert("Der Workshop ist jetzt sichtbar");
}

async function deleteWorkshop(id) {
    if (!id) id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    await axios.delete("/api/workshops", {
        data: { id }
    });
    await navigate("workshops", true);
}
