import { show_confirm_message, show_message, MESSAGE_SUCCESS, MESSAGE_ERROR, show_error, navigate } from "./navigator.js";
import * as request from "./request.js";
import { workshops } from "./workshops.js";

async function upload() {
    let file = document.getElementById("input-uploads-image").files[0];
    let formData = new FormData();
    formData.append("img", file);
    try {
        const response = await request.post("/api/upload", formData);
        const { id, name } = response.data;
        addImage(id, name, true);
        show_message(MESSAGE_SUCCESS, "Hochgeladen!");
        selectImage(id);
    } catch (e) {
        if (e instanceof request.HTTPRequestError && e.response.status === 409) {
            show_message(MESSAGE_ERROR, "Es existiert bereits ein Bild mit dem gleichen Namen.", false);
        } else {
            show_error(e);
        }
    }
}

async function deleteImage(image_id) {
    if (!await show_confirm_message("Soll das Bild wirklich gelöscht werden? Es verschwindet auch aus bereits gesendeten Newslettern."))
        return;
    await request.del(`/api/upload/${image_id}`);
    document.getElementById(`uploads-image-${image_id}`).remove();
}

function selectImage(image_id) {
    let workshopRoute = window.sessionStorage.getItem("editWorkshop");
    if (workshopRoute) {
        window.sessionStorage.removeItem("editWorkshop");
        let workshop_id = workshopRoute.substring(workshopRoute.indexOf("/") + 1);
        workshops[workshop_id].current.img = image_id;
        let container = document.getElementById(workshopRoute);
        container.getElementsByClassName("workshop-image")[0].src = `/api/upload/${image_id}`
        navigate(workshopRoute);
    }
}

function addImage(image_id, name, prepend) {
    let image = document.createElement("img");
    image.src = `/api/upload/${image_id}`;
    image.onclick = () => selectImage(image_id);

    const image_name_element = document.createElement("p");
    image_name_element.innerText = name;

    const image_delete_element = document.createElement("a");
    image_delete_element.href = "javascript:void(0)";
    image_delete_element.onclick = () => deleteImage(image_id);
    image_delete_element.innerText = "LÖSCHEN";

    const image_footer_element = document.createElement("div");
    image_footer_element.classList = "image-footer";
    image_footer_element.appendChild(image_name_element);
    image_footer_element.appendChild(image_delete_element);

    const image_container_element = document.createElement("div");
    image_container_element.id = "uploads-image-" + image_id;
    image_container_element.classList = "uploads-image";
    image_container_element.style.height = "auto";
    image_container_element.appendChild(image);
    image_container_element.appendChild(image_footer_element);

    const images_list = document.getElementById("uploads-images-list");
    if (prepend)
        images_list.prepend(image_container_element);
    else
        images_list.appendChild(image_container_element);
}

window.uploads_init = () => {
    document.querySelectorAll(".uploads-image").forEach(element => element.addEventListener("click", _ => selectImage(element.dataset.id)));
    document.querySelectorAll(".image-footer > a").forEach(element => element.addEventListener("click", _ => deleteImage(element.dataset.id)));
    document.getElementById("input-upload-button").addEventListener("click", _ => upload());
}
