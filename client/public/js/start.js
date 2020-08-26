let start_currentReview = 0;

function start_nextReview() {
    const reviews_container = document.getElementById("start-reviews");
    const speechbubbles = reviews_container.getElementsByClassName("speechbubble");

    for (speechbubble of speechbubbles)
        speechbubble.classList.remove("start-review-visible");

    speechbubbles[start_currentReview].classList.add("start-review-visible");

    start_currentReview = (start_currentReview + 1) % speechbubbles.length;
}

start_nextReview();
setInterval(start_nextReview, 10000);