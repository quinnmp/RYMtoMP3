const Lame = require("node-lame").Lame;

const encoder = new Lame({
    output: "../temp/lame_temp0.mp3",
    bitrate: 192,
}).setFile("../temp/temp0.mp3");

encoder.encode();
