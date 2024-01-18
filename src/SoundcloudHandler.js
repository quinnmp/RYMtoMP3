const fs = require("fs");
const path = require("path");
const scdl = require("soundcloud-downloader").default;
const cheerio = require("cheerio");
const { writeMP3WithMetadata } = require("./writeMP3");

const albumFolderPath = path.join(__dirname, "..", "album");

async function deleteOld() {
    return new Promise((resolve, reject) => {
        fs.readdir(albumFolderPath, (err, files) => {
            if (err) {
                console.error("Error reading folder:", err);
                reject(err);
                return;
            }

            // Loop through each file and delete it
            const deletionPromises = files.map((file) => {
                const filePath = path.join(albumFolderPath, file);

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

async function downloadTracks(data) {
    return new Promise(async (resolve, reject) => {
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        // There's a lot of layers here:
        //     Find the div with the media_link_button_container_top id
        //     Grab the data-links attribute
        //     Turn it into a JSON
        //     Grab the youtube field
        const SoundcloudLinks = JSON.parse(
            $("#media_link_button_container_top").attr("data-links")
        ).soundcloud;

        defaultLink = undefined;
        for (const key in SoundcloudLinks) {
            if (SoundcloudLinks[key].default === true) {
                defaultLink = SoundcloudLinks[key].url;
            }
        }

        await scdl
            .downloadPlaylist("https://" + defaultLink)
            .then(([streams]) => {
                streams.forEach((val, idx) => {
                    val.pipe(
                        fs.createWriteStream(
                            path.join("../album/", idx + ".mp3")
                        )
                    );
                });
                console.log("Resolving");
                resolve();
            });
    });
}

async function handleSoundcloudLink(data) {
    await deleteOld();
    console.log("Post Delete Old");
    await downloadTracks(data);
    console.log("Post Download Tracks");
    writeMP3WithMetadata(data);
}

module.exports = { handleSoundcloudLink };
