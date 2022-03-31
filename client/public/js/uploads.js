async function upload() {
    let file = document.getElementById("input-uploads-image").files[0];
    let formData = new FormData();
    formData.append("img", file);
    try {
        const response = await axios.post("/api/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
        const { name } = response.data;
        addImage(name, true);
        alert(ALERT_SUCCESS, "Hochgeladen!");
        selectImage(name);
    } catch (e) {
        if (e.response.status === 409) {
            alert(ALERT_ERROR, "Es existiert bereits ein Bild mit dem gleichen Namen.", false);
        } else {
            showError(e);
        }
    }
}

async function deleteImage(name) {
    await axios.delete(`/api/upload?name=${name}`);
    document.getElementById(`uploads-image-${name}`).remove();
}

function selectImage(name) {
    let workshopRoute = window.sessionStorage.getItem("editWorkshop");
    if (workshopRoute) {
        window.sessionStorage.removeItem("editWorkshop");
        let id = workshopRoute.substring(workshopRoute.indexOf("/") + 1);
        workshops[id].current.img = name;
        let container = document.getElementById(workshopRoute);
        container.getElementsByClassName("workshop-image")[0].src = `/api/upload?name=${name}`
        navigate(workshopRoute);
    }
}

function addImage(name, prepend) {
    let image = document.createElement("img");
    image.src = "/api/upload?name=" + name;
    image.onclick = () => selectImage(name);

    let imageName = document.createElement("p");
    imageName.innerText = name;

    let imageDelete = document.createElement("a");
    imageDelete.href = "javascript:void(0)";
    imageDelete.onclick = () => deleteImage(name);
    imageDelete.innerText = "LÖSCHEN";

    let imageContainer = document.createElement("div");
    imageContainer.id = "uploads-image-" + name;
    imageContainer.style.height = "auto";
    imageContainer.appendChild(image);
    imageContainer.appendChild(imageName);
    imageContainer.appendChild(imageDelete);

    let imagesList = document.getElementById("uploads-images-list");
    if (prepend)
        imagesList.prepend(imageContainer);
    else
        imagesList.appendChild(imageContainer);
}

function uploads_init() {
    const lazyloadImages = document.querySelectorAll(".lazy");

   for (const image of lazyloadImages) {
        image.src = image.dataset.src;
        image.addEventListener("load", () => {
            image.parentElement.style.height = "auto";
        });
    }
}
