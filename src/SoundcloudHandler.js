const fs = require("fs");
const path = require("path");
const scdl = require("soundcloud-downloader").default;
const cheerio = require("cheerio");
const { writeMP3WithMetadata } = require("./writeMP3");

let albumFolderPath = path.join(__dirname, "..", "album");

async function deleteOld() {
    return new Promise((resolve, reject) => {
        fs.readdir(albumFolderPath, (err, files) => {
            if (err) {
                console.log("This directory doesn't exist! Creating...");
                fs.mkdirSync(albumFolderPath);
                resolve();
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

async function downloadTracks(data, specifiedLink) {
    return new Promise(async (resolve, reject) => {
        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        // Grab the name of the album to name the directory
        const albumTitle = $(".album_title").contents().first().text().trim();
        albumFolderPath = path.join(__dirname, "..", albumTitle);
        await deleteOld();

        // There's a lot of layers here:
        //     Find the div with the media_link_button_container_top id
        //     Grab the data-links attribute
        //     Turn it into a JSON
        //     Grab the soundcloud field
        const SoundCloudLinks = JSON.parse(
            $("#media_link_button_container_top").attr("data-links")
        ).soundcloud;

        let defaultLink = undefined;
        if (!specifiedLink) {
            for (const key in SoundCloudLinks) {
                if (SoundCloudLinks[key].default === true) {
                    defaultLink = SoundCloudLinks[key].url;
                }
            }
        } else {
            specifiedLink = specifiedLink.replace("https://", "");
            defaultLink = specifiedLink;
        }

        defaultLinkParsed = defaultLink.split("/");

        if (defaultLinkParsed[defaultLinkParsed.length - 2] == "sets") {
            await scdl
                .downloadPlaylist("https://" + defaultLink)
                .then(([streams]) => {
                    streams.forEach((val, idx) => {
                        val.pipe(
                            fs.createWriteStream(
                                path.join(albumFolderPath, `${idx}.mp3`)
                            )
                        );
                    });
                    resolve();
                });
        } else {
            await scdl.download("https://" + defaultLink).then((stream) => {
                stream.pipe(
                    fs.createWriteStream(path.join(albumFolderPath, "0.mp3"))
                );

                resolve();
            });
        }
    });
}

async function handleSoundCloudLink(data, specifiedLink) {
    await downloadTracks(data, specifiedLink);
    writeMP3WithMetadata(data);
}

module.exports = { handleSoundCloudLink };
