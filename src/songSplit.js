const yargs = require("yargs");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const NodeID3 = require("node-id3");

const argv = yargs
    .option("timestamps", {
        alias: "t",
        describe: "Timestamps for the parts of the song",
        type: "string",
    })
    .help().argv;

const file = argv._[0];
const songName = file.split(".").slice(0, -1).join(".");
const songFolderPath = path.join(__dirname, "..", songName);

const timestamps = argv.timestamps;

console.log("File: " + file);
console.log("Timestamp string:", timestamps);

function deleteOldFiles() {
    return new Promise((resolve, reject) => {
        fs.readdir(songFolderPath, (err, files) => {
            if (err) {
                console.log("This directory doesn't exist! Creating...");
                fs.mkdirSync(songFolderPath);
                resolve();
                return;
            }

            // Loop through each file and delete it
            const deletionPromises = files.map((file) => {
                const filePath = path.join(songFolderPath, file);

                return new Promise((resolveFile, rejectFile) => {
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
                            console.log("Deleted file:", filePath);
                            resolveFile();
                        }
                    });
                });
            });

            // Wait for all deletion promises to resolve
            Promise.all(deletionPromises)
                .then(() => resolve())
                .catch((err) => reject(err));
        });
    });
}

function extractTimestamps(timestamps) {
    // Assume timestamps are in the form "M:SS"
    const pattern = /\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/g;

    // Extract timestamps
    const extractedTimestamps = timestamps.match(pattern);

    // Calculate duration in seconds for each timestamp
    const durationsInSeconds = extractedTimestamps.map((timestamp) => {
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

async function processAudio() {
    let partTimestamps = extractTimestamps(timestamps);
    await deleteOldFiles();

    // Save the metadata of the original file
    const tags = NodeID3.read(file);

    await Promise.all(
        partTimestamps.slice(0, -1).map(async (length, index) => {
            await new Promise((resolve, reject) => {
                fs.writeFile(
                    path.join(
                        songFolderPath,
                        `${songName + "_part" + index}.mp3`
                    ),
                    Buffer.alloc(0),
                    async (err) => {
                        if (err) {
                            console.error(err);
                            reject(err);
                        } else {
                            console.log(
                                `File ${
                                    songName + "_part" + index
                                }.mp3 has been created successfully.`
                            );
                            try {
                                await new Promise(
                                    (resolveFFMPEG, rejectFFMPEG) => {
                                        let audioCommand = ffmpeg(file)
                                            .setStartTime(partTimestamps[index])
                                            .audioCodec("libmp3lame")
                                            .audioQuality(0)
                                            .output(
                                                path.join(
                                                    songFolderPath,
                                                    `${
                                                        songName +
                                                        "_part" +
                                                        index
                                                    }.mp3`
                                                )
                                            )
                                            .on("end", () => {
                                                console.log(
                                                    `Audio cropped for part ${index}`
                                                );
                                                // Set metadata for the cropped file
                                                tags.title =
                                                    songName +
                                                    "(part " +
                                                    (index + 1) +
                                                    ")";
                                                NodeID3.write(
                                                    tags,
                                                    path.join(
                                                        songFolderPath,
                                                        `${
                                                            songName +
                                                            "_part" +
                                                            index
                                                        }.mp3`
                                                    )
                                                );
                                                resolveFFMPEG();
                                            })
                                            .on("error", (err) => {
                                                console.error(
                                                    "Error cropping audio:",
                                                    err.message
                                                );
                                                rejectFFMPEG(err);
                                            });
                                        // If the next duration is infinity, just go until the end of the video
                                        if (
                                            partTimestamps[index + 1] !=
                                            Number.MAX_SAFE_INTEGER
                                        ) {
                                            audioCommand.setDuration(
                                                partTimestamps[index + 1] -
                                                    partTimestamps[index]
                                            );
                                        }
                                        audioCommand.run();
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

processAudio();
