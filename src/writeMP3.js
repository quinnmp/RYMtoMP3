const NodeID3 = require("node-id3");

const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const Lame = require("node-lame").Lame;
const axios = require("axios");

const outputFolderPath = path.join(__dirname, "..", "output");

async function dataToMetadata(data) {
    const $ = cheerio.load(data);
    const trackList = $("#tracks li.track").toArray();
    trackList.splice(-1, 1);

    let album = $("div.album_title:first").text().trim();
    album = album.replace(/ By .+$/, "").trim();
    const artist = $("a.artist:first").text().trim();
    const genre = $("a.genre:first").text().trim();
    const yearHref = $("a[href^='/charts/top/album/']:first").attr("href");
    const year = yearHref ? yearHref.split("/").pop() : "";
    let image = $("img[alt^='Cover art']").attr("src");
    image = image.substring(2);

    let metadata = [];

    trackList.forEach((element, index) => {
        let title = $(element).find("span.tracklist_title:first").text().trim();
        title = title.split("\n")[0].trim();
        let trackNumber = index + 1;
        let trackMetadata = {
            title: title,
            performerInfo: artist,
            album: album,
            year: year,
            genre: genre,
            trackNumber: trackNumber,
            image: image,
        };
        metadata.push(trackMetadata);
    });

    return metadata;
}

async function writeMP3WithMetadata(data) {
    const metadataArray = await dataToMetadata(data); // Assuming dataToMetadata is a function that processes individual data items

    let image = "";
    await axios({
        method: "get",
        url: "https://e.snmc.io/i/600/w/3ff0be686fe5471e324901142395e76b/11229386/sufjan-stevens-javelin-Cover-Art.jpeg",
        responseType: "arraybuffer",
    })
        .then((response) => {
            // Embed the downloaded image as the album cover
            image = {
                type: { id: 3, name: "front cover" },
                mime: "image/jpeg", // Adjust the MIME type based on the image format
                description: "Album Cover",
                imageBuffer: Buffer.from(response.data),
            };
        })
        .catch((error) => {
            console.error("Error downloading album cover:", error.message);
        });

    const promises = metadataArray.map(async (metadata, index) => {
        const inputFile = `../temp/temp${index}.mp3`; // Input file path

        try {
            // Set the metadata
            const tags = {
                title: metadata.title,
                artist: metadata.performerInfo,
                album: metadata.album,
                year: metadata.year,
                genre: metadata.genre,
                trackNumber: metadata.trackNumber,
                image: image,
            };

            // Write the metadata to the MP3 buffer
            const taggedMp3Buffer = NodeID3.write(tags, inputFile);
        } catch (error) {
            throw `Error processing MP3 file: ${error}`;
        }
    });

    // Wait for all promises to resolve
    return Promise.all(promises).catch((error) => {
        console.error("Error processing MP3 files:", error);
    });
}

module.exports = { writeMP3WithMetadata };
