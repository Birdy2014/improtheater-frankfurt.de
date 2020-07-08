async function changeWorkshopValues() {
    let id = currentRoute.substring(currentRoute.indexOf("/") + 1);
    let container = document.getElementById(currentRoute);
    let title = container.getElementsByClassName("edit-title")[0].innerHTML;
    let content = container.getElementsByClassName("edit-content")[0].innerHTML;
    let img = container.getElementsByClassName("edit-workshop-image")[0].innerHTML;
    img = img.replace(/<br>/g, "").replace(/ /g, "");
    toggleEditWorkshopImage(true);
    await axios.put("/api/workshops", { id, title, content, img });
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

function toggleEditWorkshopImage(hide) {
    if (!loggedIn) return;
    let container = document.getElementById(currentRoute);
    let edit_image = container.getElementsByClassName("edit-workshop-image")[0];
    let image = container.getElementsByTagName("img")[0];
    if (!edit_image.style.display || hide) {
        edit_image.style.display = "none";
        image.style.filter = "";
        image.src = edit_image.innerHTML.replace(/<br>/g, "").replace(/ /g, "");
    } else {
        edit_image.style.display = "";
        image.style.filter = "blur(5px)"
    }
}
