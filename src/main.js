const axios = require("axios");
const cheerio = require("cheerio");
const yargs = require("yargs");

const { handleYouTubeLink } = require("./YouTubeHandler");
const { handleSoundCloudLink } = require("./SoundCloudHandler");

const argv = yargs
    .option("YouTubeLink", {
        alias: "u",
        describe: "Specify a specific YouTube link",
        type: "string",
    })
    .option("timestamps", {
        alias: "t",
        describe: "Specify your own timestamps to use for YouTube parsing",
        type: "string",
    })
    .option("SoundCloudLink", {
        alias: "s",
        describe: "Specify a specific SoundCloud link",
        type: "string",
    })
    .option("preferYouTube", {
        alias: "y",
        describe: "Prefer YouTube",
        type: "boolean",
    })
    .option("ignore", {
        alias: "i",
        describe: "Ignore",
        type: "boolean",
    })
    .help().argv;

// Access the parsed arguments
const url = argv._[0];
const preferYouTube = argv.preferYouTube;
const ignore = argv.ignore;
const YouTubeLink = argv.YouTubeLink;
const SoundCloudLink = argv.SoundCloudLink;
const timestamps = argv.timestamps;

console.log("URL:", url);
console.log("Prefer YouTube:", preferYouTube);
console.log("Ignore:", ignore);
console.log("YouTube Link:", YouTubeLink);
console.log("SoundCloud Link:", SoundCloudLink);
console.log("Timestamp string:", timestamps);

axios
    .get(url)
    .then((response) => {
        console.log("Response recieved from RYM!");
        data = response.data;
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        if (
            ($("#media_link_button_container_top").length == 0 ||
                $("#media_link_button_container_top").attr("data-links") ==
                    "{}") &&
            !YouTubeLink &&
            !SoundCloudLink
        ) {
            console.log("No media links! Sorry.");
            console.log(
                "You can use -u or -s to specify a YouTube or SoundCloud link you'd like to use."
            );
            return;
        }

        const mediaLinks = JSON.parse(
            $("#media_link_button_container_top").attr("data-links")
        );

        if (!preferYouTube) {
            if (
                mediaLinks.soundcloud != undefined ||
                SoundCloudLink != undefined
            ) {
                console.log("SoundCloud link found!");
                handleSoundCloudLink(data, SoundCloudLink);
            } else {
                console.log("SoundCloud link not found...");
                if (
                    mediaLinks.youtube != undefined ||
                    YouTubeLink != undefined
                ) {
                    console.log("YouTube link found!");
                    handleYouTubeLink(data, YouTubeLink, ignore, timestamps);
                } else {
                    console.log("YouTube link not found...");
                    console.log(
                        "This release doesn't have a SoundCloud or YouTube link :("
                    );
                }
            }
        } else {
            if (mediaLinks.youtube != undefined || YouTubeLink != undefined) {
                console.log("YouTube link found!");
                handleYouTubeLink(data, YouTubeLink, ignore, timestamps);
            } else {
                console.log("YouTube link not found...");
                if (
                    mediaLinks.soundcloud != undefined ||
                    SoundCloudLink != undefined
                ) {
                    console.log("SoundCloud link found!");
                    handleSoundCloudLink(data, SoundCloudLink);
                } else {
                    console.log("SoundCloud link not found...");
                    console.log(
                        "This release doesn't have a SoundCloud or YouTube link :("
                    );
                }
            }
        }
    })
    .catch((error) => {
        console.error("Error making the request:", error.message);
    });
