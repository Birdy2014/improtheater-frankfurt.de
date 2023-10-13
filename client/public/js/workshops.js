async function createWorkshop() {
    try {
        let response = await axios.post("/api/workshops");
        let id = response.data.data.id;
        invalidate_workshops_pages();
        await navigate(`workshop/${id}`, { reload: true });
        toggleWorkshopPreview();
    } catch(e) {
        showError(e);
    }
}

function invalidate_workshops_pages() {
    document.querySelectorAll(".container[id^='workshops']").forEach(container => container.remove());
}
