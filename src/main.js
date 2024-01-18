const axios = require("axios");
const cheerio = require("cheerio");

const { handleYouTubeLink } = require("./YouTubeHandler");
const { handleSoundcloudLink } = require("./SoundcloudHandler");

// Access command line arguments
const args = process.argv.slice(2); // The first two elements are node and the script file

url = args[0];

let preferSoundcloud = true;
if (args.length >= 1 && args.includes("-y")) {
    preferSoundcloud = false;
}

let ignore = false;
if (args.length >= 1 && args.includes("-i")) {
    ignore = true;
}

axios
    .get(url)
    .then((response) => {
        console.log("Response recieved from RYM!");
        data = response.data;
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        if (
            $("#media_link_button_container_top").length == 0 ||
            $("#media_link_button_container_top").attr("data-links") == "{}"
        ) {
            console.log("No media links! Sorry.");
            return;
        }

        const mediaLinks = JSON.parse(
            $("#media_link_button_container_top").attr("data-links")
        );

        if (preferSoundcloud) {
            if (mediaLinks.soundcloud != undefined) {
                console.log("Soundcloud link found!");
                handleSoundcloudLink(data);
            } else {
                console.log("Soundcloud link not found...");
                if (mediaLinks.youtube != undefined) {
                    console.log("YouTube link found!");
                    handleYouTubeLink(data);
                } else {
                    console.log("YouTube link not found...");
                    console.log(
                        "This release doesn't have a Soundcloud or YouTube link :("
                    );
                }
            }
        } else {
            if (mediaLinks.youtube != undefined) {
                console.log("YouTube link found!");
                handleYouTubeLink(data, ignore);
            } else {
                console.log("YouTube link not found...");
                if (mediaLinks.soundcloud != undefined) {
                    console.log("Soundcloud link found!");
                    handleSoundcloudLink(data);
                } else {
                    console.log("Soundcloud link not found...");
                    console.log(
                        "This release doesn't have a Soundcloud or YouTube link :("
                    );
                }
            }
        }
    })
    .catch((error) => {
        console.error("Error making the request:", error.message);
    });
