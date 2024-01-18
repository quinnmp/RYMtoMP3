# RYM to MP3
This tool uses rateyourmusic.com along with YouTube and Soundcloud integration to download music with all the correct MP3 metadata. This is optimized for uploading to Spotify as local files.

Soundcloud is preferred as tracks are already cropped into individual tracks, and YouTube uploads are usually uploaded as one full 40-some-minute long video for the entire album.
However, if Soundcloud is not an option, this script will take the track lengths from RYM and crop a full YouTube video into individual sections representing tracks.

## Usage
Make sure npm and node are installed.

Run `npm install`. Then, just run `node ./main.js {rym link}` in the `src` directory.

## Additional Options
This script prefers Soundcloud by default. Adding `-y` will prefer YouTube, then if that fails, use Soundcloud.

This script rejects YouTube as an option if the RYM album length and YouTube video differ by more than 2 seconds. To ignore this, add `-i` to your command.

For example, if I wanted to prefer YouTube and ignore this album length discrepancy check, I would run

`node ./main.js {rym link} -y -i`
