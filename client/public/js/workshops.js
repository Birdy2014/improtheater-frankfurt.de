async function createWorkshop() {
    try {
        let response = await axios.post("/api/workshops");
        let id = response.data.data.id;
        await navigate("workshops", true, true, true);
        await navigate(`workshop/${id}`, true);
    } catch(e) {
        alert("Fehler: " + e);
    }
}
