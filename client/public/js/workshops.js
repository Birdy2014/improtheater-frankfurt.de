async function createWorkshop() {
    let title = document.getElementById("create-workshop-title").value;
    if (!title) {
        alert("Bitte geben sie einen Namen an");
        return;
    }
    await axios.post("/api/workshops", { title });
    await navigate("workshops", true);
}
