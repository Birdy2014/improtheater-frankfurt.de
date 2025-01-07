let current_review = 1;

function next_review() {
    const reviews_container = document.getElementById("start-reviews");
    const speechbubbles = reviews_container.getElementsByClassName("speechbubble");

    for (const speechbubble of speechbubbles)
        speechbubble.classList.remove("start-review-visible");

    speechbubbles[current_review].classList.add("start-review-visible");

    current_review = (current_review + 1) % speechbubbles.length;
}

window.start_init = () => {
    setInterval(next_review, 10000);
}
