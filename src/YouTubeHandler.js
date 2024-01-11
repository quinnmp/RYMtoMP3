const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const { writeMP3WithMetadata } = require("./writeMP3");

const tempFolderPath = path.join(__dirname, "..", "temp");

function getTrackLengths(data) {
    return new Promise((resolve, reject) => {
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        // Find the <ul> element with id "tracks"
        const ulElement = $("#tracks");

        // Check if the element is found
        if (ulElement.length > 0) {
            // Find all <li> elements inside the <ul>
            const liElements = ulElement.find("li");

            // Extract text content from the final <span> element in each <li>
            let spanTextArray = liElements
                .map((index, element) => {
                    const durationSpan = $(element).find(
                        "span.tracklist_duration"
                    );
                    const duration = Number(
                        durationSpan.attr("data-inseconds")
                    );
                    return duration;
                })
                .get()
                .filter((duration) => !isNaN(duration));
            // Convert each timestamp in the array to seconds
            resolve(spanTextArray);
        } else {
            console.error('No <ul> element with id "tracks" found.');
            reject(error);
        }
    });
}

async function downloadTracks(data) {
    try {
        const trackLengths = await getTrackLengths(data);
        console.log(trackLengths);
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        // There's a lot of layers here:
        //     Find the div with the media_link_button_container_top id
        //     Grab the data-links attribute
        //     Turn it into a JSON
        //     Grab the youtube field
        const YouTubeLinks = JSON.parse(
            $("#media_link_button_container_top").attr("data-links")
        ).youtube;

        defaultID = undefined;
        for (const key in YouTubeLinks) {
            if (YouTubeLinks[key].default === true) {
                defaultID = key;
            }
        }

        await new Promise((resolve, reject) => {
            // console.log("Downloading audio...");
            // const audioStream = ytdl(
            //     `https://www.youtube.com/watch?v=${defaultID}`,
            //     {
            //         quality: "highestaudio",
            //         filter: "audioonly",
            //     }
            // );

            // audioStream.pipe(fs.createWriteStream("audio.mp3"));

            // audioStream.on("end", () => {
            console.log("Audio downloaded! Cropping...");

            fs.readdir(tempFolderPath, (err, files) => {
                if (err) {
                    console.error("Error reading folder:", err);
                    return;
                }

                // Loop through each file and delete it
                files.forEach((file) => {
                    const filePath = path.join(tempFolderPath, file);

                    // Delete the file
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(
                                "Error deleting file:",
                                filePath,
                                err
                            );
                        } else {
                            console.log("Deleted file:", filePath);
                        }
                    });
                });
            });

            let seconds = 0;

            trackLengths.forEach(async (trackLength, index) => {
                fs.writeFile(
                    `temp/temp${index}.mp3`,
                    Buffer.alloc(0),
                    (err) => {
                        if (err) {
                            console.error(err);
                        } else {
                            console.log(
                                `File temp/temp${index}.mp3 has been created successfully.`
                            );
                            // Use fluent-ffmpeg for cropping
                            ffmpeg("audio.mp3")
                                .setStartTime(seconds) // Start time in seconds
                                .setDuration(trackLength) // Duration in seconds
                                .audioCodec("libmp3lame")
                                // .audioBitrate(192) // Specify LAME codec
                                .output(`temp/temp${index}.mp3`)
                                .on("end", () => {
                                    console.log("Audio cropped successfully!");
                                    resolve();
                                })
                                .on("error", (err) => {
                                    console.error(
                                        "Error cropping audio:",
                                        err.message
                                    );
                                    reject(err);
                                })
                                .run();
                            seconds += trackLength;
                        }
                    }
                );
            });
            // });

            // audioStream.on("error", (err) => {
            //     console.error("Error downloading audio:", err.message);
            //     reject(err);
            // });
        });
    } catch (error) {
        console.error("Error in downloadTracks:", error.message);
    }
}

const url = "https://rateyourmusic.com/release/album/sufjan-stevens/javelin/";
let data = undefined;
axios
    .get(url)
    .then(async (response) => {
        console.log("Response recieved from RYM!");
        data = response.data;
        await downloadTracks(data);
        writeMP3WithMetadata(data);
    })
    .catch((error) => {
        console.error("Error making the request:", error.message);
        return undefined;
    });
