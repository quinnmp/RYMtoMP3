const NodeID3 = require("node-id3");

const cheerio = require("cheerio");
const path = require("path");
const axios = require("axios");

const outputFolderPath = path.join(__dirname, "..", "output");

async function dataToMetadata(data) {
    const $ = cheerio.load(data);
    const trackList = $("#tracks li.track").toArray();
    trackList.splice(-1, 1);

    let album = $("div.album_title:first").text().trim();
    album = album.replace(/ By .+$/, "").trim();
    const artists = $("span[itemprop='byArtist'] a.artist");
    let artistTexts = "";
    artists.each(function (index, element) {
        // Replace each item with its text value
        const artistText = $(element).text().trim();
        artistTexts = artistTexts + artistText + "\0";
    });
    artistTexts = artistTexts.substring(0, artistTexts.length - 1);
    const genres = $("span.release_pri_genres a.genre");
    let genreTexts = "";
    genres.each(function (index, element) {
        // Replace each item with its text value
        const genreText = $(element).text().trim();
        genreTexts = genreTexts + genreText + "\0";
    });
    genreTexts = genreTexts.substring(0, genreTexts.length - 1);

    // Get an array of all track li elements
    let tracks = $("ul.tracks:first li.track");
    tracks = tracks.slice(0, -1);
    let featuredArtistTexts = [];
    tracks.each(function (index, element) {
        // Search for links to artists within the track li - this means they are a featured artist
        const featuredArtists = $(element).find("li.featured_credit a.artist");
        featuredArtistTexts.push("");

        // Loop through each found link within the current track li
        featuredArtists.each(function (artistIndex, artistElement) {
            // Replace each item with its text value
            const featuredArtistText = $(artistElement).text().trim();
            featuredArtistTexts[index] =
                featuredArtistTexts[index] + featuredArtistText + "\0";
        });
        featuredArtistTexts[index] = featuredArtistTexts[index].substring(
            0,
            featuredArtistTexts[index].length - 1
        );
    });
    const yearHref = $("a[href^='/charts/top/album/']:first").attr("href");
    const year = yearHref ? yearHref.split("/").pop() : "";
    let imageURL = $("img[alt^='Cover art']").attr("src");
    if (imageURL) {
        imageURL = imageURL.substring(2);
    }

    let image = "";

    await axios({
        method: "get",
        url: `https://${imageURL}`,
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

    let metadata = [];

    trackList.forEach((element, index) => {
        let title = $(element).find("span.tracklist_title:first").text().trim();
        title = title.split("\n")[0].trim();
        let trackArtists = artistTexts;
        if (featuredArtistTexts[index] != "") {
            trackArtists = trackArtists + "\0" + featuredArtistTexts[index];
        }
        let trackNumber = index + 1;
        let trackMetadata = {
            title: title,
            performerInfo: trackArtists,
            album: album,
            year: year,
            genre: genreTexts,
            trackNumber: trackNumber,
            image: image,
        };
        metadata.push(trackMetadata);
    });

    return metadata;
}

async function writeMP3WithMetadata(data) {
    const metadataArray = await dataToMetadata(data); // Assuming dataToMetadata is a function that processes individual data items

    const promises = metadataArray.map(async (metadata, index) => {
        const inputFile = `../album/${index}.mp3`; // Input file path

        try {
            // Set the metadata
            const tags = {
                title: metadata.title,
                artist: metadata.performerInfo,
                album: metadata.album,
                year: metadata.year,
                genre: metadata.genre,
                trackNumber: metadata.trackNumber,
                image: metadata.image,
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
