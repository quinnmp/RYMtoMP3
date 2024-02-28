const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const { writeMP3WithMetadata } = require("./writeMP3");

let albumFolderPath = path.join(__dirname, "..", "album");
let trackLengths = [];
let ignoreDiscrepancy = false;
let customTimestamps = "";
let downloadSuccessful = false;

async function getVideoLength(videoUrl) {
    try {
        const info = await ytdl.getInfo(videoUrl);
        const videoLengthInSeconds = info.videoDetails.lengthSeconds - 1;
        return videoLengthInSeconds;
    } catch (error) {
        console.error("Error getting video length:", error.message);
        throw error;
    }
}

function getTrackLengths(data) {
    return new Promise((resolve, reject) => {
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        // Grab the name of the album to name the directory
        const albumTitle = $(".album_title").contents().first().text().trim();
        albumFolderPath = path.join(__dirname, "..", albumTitle);

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
                .filter((duration) => !isNaN(duration) && duration != 0);

            let cumulativeTimestampArray = [];
            if (customTimestamps) {
                cumulativeTimestampArray =
                    handleCustomTimestamps(customTimestamps);
                if (
                    cumulativeTimestampArray.length - 1 !=
                    spanTextArray.length
                ) {
                    throw new Error(
                        `Got ${
                            cumulativeTimestampArray.length - 1
                        } custom timestamps, but there should be ${
                            spanTextArray.length
                        }`
                    );
                }
            } else {
                cumulativeTimestampArray = [0];

                for (let i = 0; i < spanTextArray.length; i++) {
                    cumulativeTimestampArray.push(
                        cumulativeTimestampArray[i] + spanTextArray[i]
                    );
                }
            }

            resolve(cumulativeTimestampArray);
        } else {
            console.error('No <ul> element with id "tracks" found.');
            reject(error);
        }
    });
}

async function downloadTracks(data, specifiedLink) {
    try {
        trackLengths = await getTrackLengths(data);
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

        const videoUrl = specifiedLink
            ? specifiedLink
            : `https://www.youtube.com/watch?v=${defaultID}`;
        await getVideoLength(videoUrl)
            .then((length) => {
                const duration = length;
                if (
                    !ignoreDiscrepancy &&
                    Math.abs(duration - trackLengths[trackLengths.length - 1]) >
                        2
                ) {
                    throw new Error(
                        "Album duration and YouTube video length differ by more than 2 seconds, indicating some poor cropping. Run again with -i to ignore this error."
                    );
                }
                console.log("Downloading audio...");
                const audioStream = ytdl(videoUrl, {
                    quality: "highestaudio",
                    filter: "audioonly",
                });

                audioStream.pipe(fs.createWriteStream("fullAudio.mp3"));

                const deleteAlbumFiles = () => {
                    return new Promise((resolve, reject) => {
                        fs.readdir(albumFolderPath, (err, files) => {
                            if (err) {
                                console.log(
                                    "This directory doesn't exist! Creating..."
                                );
                                fs.mkdirSync(albumFolderPath);
                                resolve();
                                return;
                            }

                            // Loop through each file and delete it
                            const deletionPromises = files.map((file) => {
                                const filePath = path.join(
                                    albumFolderPath,
                                    file
                                );

                                return new Promise(
                                    (resolveFile, rejectFile) => {
                                        // Delete the file
                                        fs.unlink(filePath, (err) => {
                                            if (err) {
                                                console.error(
                                                    "Error deleting file:",
                                                    filePath,
                                                    err
                                                );
                                                rejectFile(err);
                                            } else {
                                                console.log(
                                                    "Deleted file:",
                                                    filePath
                                                );
                                                resolveFile();
                                            }
                                        });
                                    }
                                );
                            });

                            // Wait for all deletion promises to resolve
                            Promise.all(deletionPromises)
                                .then(() => resolve())
                                .catch((err) => reject(err));
                        });
                    });
                };

                audioStream.on("error", (err) => {
                    console.error("Error downloading audio:", err.message);
                });

                // Return a promise that resolves when audioStream ends
                return new Promise((resolve, reject) => {
                    audioStream.on("end", async () => {
                        downloadSuccessful = true;

                        console.log("Deleting old album files...");
                        await deleteAlbumFiles();
                        resolve();
                    });

                    audioStream.on("error", (err) => {
                        reject(err);
                    });
                });
            })
            .catch((error) => {
                console.error("Error getting video length:", error.message);
                throw new Error("Failed to get video length");
            });
    } catch (error) {
        console.error("Error in downloadTracks:", error.message);
    }
}

async function processAudio() {
    await Promise.all(
        trackLengths.slice(0, -1).map(async (length, index) => {
            await new Promise((resolve, reject) => {
                fs.writeFile(
                    path.join(albumFolderPath, `${index}.mp3`),
                    Buffer.alloc(0),
                    async (err) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        } else {
                            console.log(
                                `File ${index}.mp3 has been created successfully.`
                            );
                            try {
                                await new Promise(
                                    (resolveFFMPEG, rejectFFMPEG) => {
                                        let audioCommand = ffmpeg(
                                            "fullAudio.mp3"
                                        )
                                            .setStartTime(trackLengths[index])
                                            .audioCodec("libmp3lame")
                                            .audioQuality(0)
                                            .output(
                                                path.join(
                                                    albumFolderPath,
                                                    `${index}.mp3`
                                                )
                                            )
                                            .on("end", () => {
                                                console.log(
                                                    `Audio cropped for track ${index}`
                                                );
                                                resolveFFMPEG();
                                            });
                                        // If the next duration is infinity, just go until the end of the video
                                        try {
                                            audioCommand
                                                .clone()
                                                .setDuration(
                                                    trackLengths[index + 1] -
                                                        trackLengths[index]
                                                )
                                                .run();
                                        } catch (error) {
                                            // If this fails, we assume it's a bad duration and remove it
                                            console.log(
                                                "Bad duration! We assume this means that we have a timestamp past the end of the file. Check timestamps!"
                                            );
                                            console.log(
                                                "Cropping without duration..."
                                            );
                                            audioCommand
                                                .on("error", (err) => {
                                                    console.error(
                                                        "Error cropping audio:",
                                                        err.message
                                                    );
                                                    rejectFFMPEG(err);
                                                })
                                                .run();
                                        }
                                    }
                                );
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        }
                    }
                );
            });
        })
    );
}

function handleCustomTimestamps(customTimestamps) {
    // Assume timestamps are in the form "M:SS"
    const pattern = /\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/g;

    // Extract timestamps
    const timestamps = customTimestamps.match(pattern);

    // Calculate duration in seconds for each timestamp
    const durationsInSeconds = timestamps.map((timestamp) => {
        const [seconds, minutes, hours] = timestamp
            .split(":")
            .map(Number)
            .reverse();
        if (hours) {
            return hours * 3600 + minutes * 60 + seconds;
        } else {
            return minutes * 60 + seconds;
        }
    });

    // We don't know how long the album is. Assume the last track goes to the end of the video by passing in infinity here.
    durationsInSeconds.push(Number.MAX_SAFE_INTEGER);

    return durationsInSeconds;
}

async function handleYouTubeLink(data, specifiedLink, ignore, timestamps) {
    ignoreDiscrepancy = ignore;
    customTimestamps = timestamps;
    await downloadTracks(data, specifiedLink);
    if (downloadSuccessful) {
        await processAudio();
        console.log("All audio cropped!");
        writeMP3WithMetadata(data);
    }
}

module.exports = { handleYouTubeLink };
