let start_currentReview = 1;

function start_nextReview() {
    const reviews_container = document.getElementById("start-reviews");
    const speechbubbles = reviews_container.getElementsByClassName("speechbubble");

    for (const speechbubble of speechbubbles)
        speechbubble.classList.remove("start-review-visible");

    speechbubbles[start_currentReview].classList.add("start-review-visible");

    start_currentReview = (start_currentReview + 1) % speechbubbles.length;
}

setInterval(start_nextReview, 10000);
