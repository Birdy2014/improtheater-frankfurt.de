getImages().then(images => {
    for (let image of images) {
        addImage(image.name, false);
    }
});

async function upload() {
    let file = document.getElementById("input-uploads-image").files[0];
    let formData = new FormData();
    formData.append("img", file);
    try {
        await axios.post("/api/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
        addImage(file.name, true);
        alert("Hochgeladen!");
    } catch (e) {
        alert("Fehler");
        console.log(JSON.stringify(e));
    }
}

async function deleteImage(name) {
    await axios.delete(`/api/upload?name=${name}`);
    document.getElementById(`uploads-image-${name}`).remove();
}

function selectImage(name) {
    // TODO set workshop image if currently editing workshop
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
    imageContainer.appendChild(image);
    imageContainer.appendChild(imageName);
    imageContainer.appendChild(imageDelete);

    let imagesList = document.getElementById("uploads-images-list");
    if (prepend)
        imagesList.prepend(imageContainer);
    else
        imagesList.appendChild(imageContainer);
}

async function getImages() {
    let response = await axios.get("/api/upload");
    return response.data;
}