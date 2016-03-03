"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}

var util = require("util"),
    url = require("url"),
    fs = require("fs"),
    ffmpeg = require("fluent-ffmpeg"),
    kShuffle = require("knuth-shuffle").knuthShuffle,
    youtubedl = require("youtube-dl"),
    moment = require("moment"),
    events = require("events"),
    exec = require("child_process"),
    //RateLimiter = require("limiter").RateLimiter,
    eventEmitter = new events.EventEmitter();

//var limiter = new RateLimiter(2, 5000);

var MusicManager = (function() {
    function MusicManager(discordBot) {
        _classCallCheck(this, MusicManager);

        MusicManager.nowPlaying = {
            currentTime: 0,
            url: "",
            videoUrl: "",
            title: "",
            length: "",
            ext: "",
            localFile: ""
        };
        MusicManager.queue = [];
        MusicManager.voiceConnection;
        MusicManager.discordBot;
        MusicManager.prototype.extractors(function(extracts) {
            MusicManager.extractors = extracts;
        });
        MusicManager.addQueue = [];
        MusicManager.downloading = false;
        MusicManager.paused = true;
        MusicManager.pausedAt = 0;
    }

    // event handlers
    eventEmitter.on("song done", function() {
        // check if new now playing has a local file
        if (MusicManager.queue[0].localFile !== "") {
            MusicManager.prototype.play();
        } else {
            MusicManager.prototype.download(0);
        }
    });

    eventEmitter.on("download complete", function() {
        // check if the first n items in the queue are downloaded
        // and download them if they are not
        util.log("download complete fired.");
        //if (!MusicManager.downloading) {
        var noFile = true;
        var queuePos;

        var iterate;

        if (MusicManager.queue.length < 2) {
            iterate = MusicManager.queue.length;
        } else {
            iterate = MusicManager.queue.length;
        }

        while (noFile) {
            for (var i = 0; i < iterate; i++) {
                if (MusicManager.queue[i].localFile === "") {
                    queuePos = i;
                    MusicManager.queue[i].localFile = "in progress";
                    MusicManager.prototype.download(queuePos);
                    noFile = false;
                }
                if (i === iterate - 1) {
                    noFile = false;
                }
            }
        }

        //}
    });

    eventEmitter.on("song added", function() {
        util.log("song added handler");
        var url = MusicManager.addQueue.shift();
        util.log(url);
        //limiter.removeTokens(1, function() {
        MusicManager.prototype.videoInfo(url, function(err, info) {
            if (err === true) {

            } else {
                MusicManager.queue.push({
                    url: url,
                    videoUrl: info.url,
                    title: info.title,
                    length: info.duration,
                    ext: info.ext,
                    localFile: ""
                });

                if (MusicManager.queue.length == 1) {
                    MusicManager.prototype.download(0);
                }

                if (MusicManager.downloading === false) {
                    MusicManager.prototype.download(MusicManager.queue.length);
                }
            }

            //eventEmitter.emit("info");
        });

        //});
    });

    eventEmitter.on("info", function() {
        // try to download the top 1/2 songs

        //limiter.removeTokens(1, function() {
        //MusicManager.prototype.download();
        //});
    });

    MusicManager.prototype.setVoiceConnection = function setVoiceConnection(connection) {
        MusicManager.voiceConnection = connection;
    }

    MusicManager.prototype.getNowPlaying = function getNowPlaying(callback) {
        callback(false, MusicManager.prototype.formatNowPlaying(MusicManager.nowPlaying));
    };

    MusicManager.prototype.getQueue = function getQueue(callback) {
        callback(false, MusicManager.prototype.formatQueue(MusicManager.queue));
    };

    MusicManager.prototype.extractors = function extractors(callback) {
        youtubedl.getExtractors(true, function(err, list) {
            console.log("Found " + list.length + " extractors");
            var extractors = [];
            for (var i = 0; i < list.length; i++) {
                extractors.push(list[i]);
            }
            callback(extractors);
        });
    };

    MusicManager.prototype.addPlaylist = function addPlaylist(link, callback) {
        var urls = MusicManager.prototype.getPlaylistUrls(link);
        util.log(urls);
        util.log(urls.length);
        callback(urls.length);
        for (var i in urls) {
            MusicManager.prototype.add(urls[i].url, function(err, info) {
                if (err) {
                    util.log("Error adding playlist: " + link);
                }
            });
        }
    };

    MusicManager.prototype.add = function add(link, callback) {
        // check if its a youtube playlist
        if (link.search("https://www.youtube.com/playlist?") > -1 || link.search("http://www.youtube.com/playlist?") > -1) {
            MusicManager.prototype.addPlaylist(link, function(items) {
                callback(false, {
                    isPlaylist: true,
                    amountOfItems: items
                });
            });
        } else {
            // make sure the link is supported
            MusicManager.prototype.checkLink(link, function(err) {
                // if its not in the list
                if (!err) {
                    callback(true, {
                        pos: null,
                        when: null
                    });
                }

                MusicManager.addQueue.push(link);
                MusicManager.prototype.queueInfo(MusicManager.queue.length, function(time) {
                    callback(false, {
                        pos: MusicManager.queue.length + 1,
                        when: time
                    });
                });
                eventEmitter.emit("song added");
            });
        }
    };

    MusicManager.prototype.download = function download(queuePos) {
        // downloads the first in queue with an empty localFile

        // TODO: check if the file already exists BEFORE downloading again
        util.log(MusicManager.queue.length);

        var audioPrefix = "./audio/";
        MusicManager.downloading = true;
        var video = youtubedl(MusicManager.queue[queuePos].videoUrl);
        var name = require("crypto").createHash("md5").update(MusicManager.queue[queuePos].title).digest("hex");
        var prefix = "./videos/";
        var ext = MusicManager.queue[queuePos].ext;
        var videoFileName = name + "." + ext;
        var ws = fs.createWriteStream(prefix + videoFileName);
        video.pipe(ws);

        ws.on("finish", function() {
            util.log(MusicManager.queue[queuePos].title + " downloaded to " + prefix + videoFileName);

            // convert/demux with ffmpeg
            util.log("Converting file to audio...");

            if (ext === "mp4a" || ext === "mp3") {
                util.log("already an audio file... Skipping conversion/demux");
                fs.createReadStream(prefix + videoFileName).on("error", function() {
                    util.log("Could not read file at original location.");
                }).pipe(fs.createWriteStream(audioPrefix + videoFileName).on("error", function() {
                    util.log("Could not write to new file location.");
                }).on("finish", function() {
                    // set localFileLocation
                    util.log("Song added successfully.");
                    MusicManager.queue[queuePos].localFile = audioPrefix + videoFileName;
                    if (queuePos == 0) {
                        // this is the first song added, populate nowPlaying...
                        MusicManager.nowPlaying.currentTime = 0;
                        MusicManager.nowPlaying.url = MusicManager.queue[0].url;
                        MusicManager.nowPlaying.videoUrl = MusicManager.queue[0].videoUrl;
                        MusicManager.nowPlaying.title = MusicManager.queue[0].title;
                        MusicManager.nowPlaying.length = MusicManager.queue[0].length;
                        MusicManager.nowPlaying.ext = MusicManager.queue[0].ext;
                        MusicManager.nowPlaying.localFile = MusicManager.queue[0].localFile;
                    }
                    eventEmitter.emit("download complete");
                }));
            } else {
                // convert any other file type to mp3
                ffmpeg(prefix + videoFileName).audioCodec("libmp3lame").format("mp3").on("error", function(err, stdout, stderr) {
                    util.log("Error converting video->audio: ", err.message);
                }).on("end", function() {
                    util.log("File " + videoFileName + " converted successfully.");
                }).save(audioPrefix + name + ".mp3");

                MusicManager.queue[queuePos].localFile = audioPrefix + name + ".mp3";
                if (queuePos == 0) {
                    // this is the first song added, populate nowPlaying...
                    MusicManager.nowPlaying.currentTime = 0;
                    MusicManager.nowPlaying.url = MusicManager.queue[0].url;
                    MusicManager.nowPlaying.videoUrl = MusicManager.queue[0].videoUrl;
                    MusicManager.nowPlaying.title = MusicManager.queue[0].title;
                    MusicManager.nowPlaying.length = MusicManager.queue[0].length;
                    MusicManager.nowPlaying.ext = MusicManager.queue[0].ext = "mp3";
                    MusicManager.nowPlaying.localFile = MusicManager.queue[0].localFile;
                }

                eventEmitter.emit("download complete");
                MusicManager.downloading = false;
            }
        });
    };

    MusicManager.prototype.play = function play(callback) {
        // plays the song in the nowPlaying field
        // play video audio using ffmpeg
        // pop the queue
        // change now playing
        // Emit "song removed" event, which triggers downloading of the next song

        util.log(MusicManager.pausedAt);
        var options = {
            seek: MusicManager.pausedAt
        };

        if (MusicManager.voiceConnection === undefined) {
            if (callback !== undefined) {
                callback(false, "!summon me first!");
            }
        } else {
            if (callback !== undefined) {
                callback(false, "Now playing: " + MusicManager.nowPlaying.title);
            }
            MusicManager.voiceConnection.playFile(MusicManager.nowPlaying.localFile, options, function(error, stream) {
                MusicManager.paused = false;
                stream.on("time", function(time) {
                    // time is the current time of the song in milliseconds
                    MusicManager.nowPlaying.currentTime = time;
                }).on("end", function() {
                    if (MusicManager.paused === false) {
                        MusicManager.prototype.nextSong(function(err) {
                            if (err === false) {
                                util.log("song done");
                                MusicManager.pausedAt = 0;
                                MusicManager.emit("song done");
                                eventEmitter.emit("song done");
                            }
                        });
                    }

                    //MusicManager.prototype.play();
                }).on("error", function() {
                    util.log("Playback error.");
                });
            });
        }
    };

    MusicManager.prototype.nextSong = function nextSong(callback) {
        // cyclical queue for now at least
        // pop the queue array array, add to the end (repeat playlist)
        MusicManager.queue.push(MusicManager.queue.shift());

        // move the new top of queue to nowPlaying
        MusicManager.nowPlaying.currentTime = 0;
        MusicManager.nowPlaying.url = MusicManager.queue[1].url;
        MusicManager.nowPlaying.videoUrl = MusicManager.queue[1].videoUrl;
        MusicManager.nowPlaying.title = MusicManager.queue[1].title;
        MusicManager.nowPlaying.length = MusicManager.queue[1].length;
        MusicManager.nowPlaying.ext = MusicManager.queue[1].ext;
        MusicManager.nowPlaying.localFile = MusicManager.queue[1].localFile;

        callback(false);
    }

    MusicManager.prototype.shuffle = function shuffle(callback) {
        var newQueue = kShuffle(MusicManager.queue.slice(0));
        MusicManager.queue = newQueue;
        var out = MusicManager.prototype.formatQueue(MusicManager.queue);

        callback(false, out);
    };

    MusicManager.prototype.pause = function pause(callback) {
        MusicManager.pausedAt = Math.floor(MusicManager.nowPlaying.currentTime / 1000);
        MusicManager.voiceConnection.stopPlaying();
        MusicManager.paused = true;
        callback(false, "Playback paused.");
    };

    MusicManager.prototype.skip = function skip(callback) {
        if (MusicManager.queue[1].localFile !== "" || MusicManager.queue[1].localFile !== "in progress") {
            // next song already downloaded, start playback now
            MusicManager.prototype.nextSong(function(err) {
                if (err === false) {
                    callback(false, "Skiping!");
                    MusicManager.prototype.play();
                }
            });
        } else {
            MusicManager.prototype.nextSong(function(err) {
                if (err === false) {
                    callback(false, "Next song is downloading, playback will start when complete.");
                }
            });
        }
    };

    MusicManager.prototype.checkLink = function checkLink(toCheck, callback) {
        var urlData = url.parse(toCheck);
        if (MusicManager.extractors.indexOf(urlData.host)) {
            // link is parsable
            callback(true);
        } else {
            callback(false);
        }
    };

    MusicManager.prototype.videoInfo = function videoInfo(link, callback) {
        youtubedl.getInfo(link, function(err, info) {
            if (err) {
                callback(true, info);
                util.log(err);
            } else {
                callback(false, info);
            }
        });
    };

    MusicManager.prototype.queueInfo = function queueInfo(arrayPos, callback) {
        var durr = moment.duration();
        for (var i = 1; i < arrayPos; i++) {
            MusicManager.queue[i]["length"]
            durr.add(MusicManager.queue[i]["length"]);
        }
        durr.add(MusicManager.nowPlaying.currentTime);

        callback(MusicManager.prototype.convertTime(durr));
    };

    MusicManager.prototype.formatQueue = function formatQueue(queue) {
        var out = "```The current song queue is: \n";
        for (var i in queue) {
            if (i === 0) {
                out = out + (i * 1 + 1) + ". [Now Playing]" + queue[i].title;
            } else {
                out = out + (i * 1 + 1) + ". " + queue[i].title;
            }
            if (queue[i].localFile === "" || queue[i].localFile === "in progress") {
                out = out + " [downloading]\n";
            } else {
                out = out + "\n";
            }
        }
        out = out + "```";

        return out;
    };

    MusicManager.prototype.formatNowPlaying = function formatNowPlaying(nowPlaying) {
        var out = "```";

        out = out + nowPlaying.title + " " + MusicManager.prototype.convertTime(nowPlaying.currentTime) + "```";

        return out;
    };

    MusicManager.prototype.convertTime = function convertTime(time) {
        var durr = moment.duration(MusicManager.nowPlaying.currentTime);
        var hours = Math.floor(durr.asHours());
        var mins = Math.floor(durr.asMinutes() - hours * 60);
        var secs = Math.floor(durr.asSeconds() - mins * 60);

        if (hours < 1) {
            if (secs < 10) {
                return "[" + mins + ":0" + secs + "].";

            } else {
                return "[" + mins + ":" + secs + "].";
            }
        } else {
            return "[" + hours + ":" + mins + ":" + secs + "].";
        }
    };

    MusicManager.prototype.getPlaylistUrls = function getPlaylistUrls(link) {
        var playListJson;
        if (process.platform === "win32") {
            playListJson = exec.execFileSync("youtube-dl.exe", [link, "--flat-playlist", "-j"]);
        } else {
            playListJson = exec.execSync("python node_modules/youtube-dl/bin/youtube-dl " + link + " --flat-playlist -j");
        }

        var outString = playListJson.toString().replace(/\n$/, "").split("\n");
        var finalJsonString = "[";
        for (var entry in outString) {
            if (entry == outString.length - 1) {
                finalJsonString = finalJsonString + outString[entry] + "]";
            } else {
                finalJsonString = finalJsonString + outString[entry] + ",";
            }
        }
        var finalJson = JSON.parse(finalJsonString);
        //console.log(finalJson);

        var urls = [];
        for (var video in finalJson) {
            if (finalJson[video].title !== "[Deleted Video]") {
                urls.push({
                    title: finalJson[video].title,
                    url: "http://www.youtube.com/watch?v=" + finalJson[video].url
                });
            }
        }

        return urls;
    };

    return MusicManager;
})();

util.inherits(MusicManager, events.EventEmitter);

exports.MusicManager = MusicManager;