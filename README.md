# RYM to MP3 (beta)
This tool uses [rateyourmusic.com](https://rateyourmusic.com/) and its included YouTube and SoundCloud media links to download music with all the correct MP3 metadata. RYM is a music database site with a vast amount of unreleased music that isn't on traditional streaming services, so this script is optimized for uploading to Spotify as local files. All of this can be done simply by running one command with a RYM URL as an argument, see below.

SoundCloud is preferred as tracks are already cropped into individual tracks, and YouTube uploads are usually uploaded as one full 40-some-minute long video for the entire album.
However, if SoundCloud is not an option, this script will take the track lengths from RYM and crop a full YouTube video into individual sections representing tracks.

## Usage
Make sure npm and node are installed.

Run `npm install`. Then, just run `node ./main.js {rym link}` in the `src` directory.

Wait for the script to fully finish, and your downloaded tracks with all the metadata can be found in the `\album` directory. Enjoy!

## Additional Options
This script prefers SoundCloud by default. Adding `-y` will prefer YouTube, then if that fails, use SoundCloud.

This script rejects YouTube as an option if the RYM album length and YouTube video differ by more than 2 seconds. To ignore this, add `-i` to your command.

For example, if I wanted to prefer YouTube and ignore this album length discrepancy check, I would run

`node ./main.js {rym link} -y -i`

## Development
I wrote this script for my own personal use so it certainly isn't perfect and is not widely tested. If you test this and find issues, feel free to leave an issue or PR or otherwise contact me.
