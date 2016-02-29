var Discord = require("discord.js"),
    util = require("util"),
    fs = require("fs"),
    yaml = require("js-yaml"),
    reload = require("require-reload")(require);

var config, permissions;

try {
    config = yaml.safeLoad(fs.readFileSync("./config.yml", "utf8"));
    permissions = yaml.safeLoad(fs.readFileSync("./permissions.yml", "utf8"));
} catch (e) {
    util.log("Error loading settings: " + e);
}

// Commands
var refresh = reload("./commands/reload"), // internal name is refresh because require-reload
    MusicManager = reload("./commands/music");
//pause = reload("./commands/pause"),
//unpause = reload("./commands/unpause");

// Setup the discord client
var bot = new Discord.Client();
bot.login(config.botLogin, config.botPassword);

// contains all state data about anything to do with music
var music = new MusicManager.MusicManager(bot);

var getPermissions = function getPermissions(userId) {
    var hasPerms = false;
    var perms;

    permissions = yaml.safeLoad(fs.readFileSync("./permissions.yml", "utf8"));
    var users = Object.keys(permissions);

    for (var i in users) {
        if (!hasPerms) {
            if (users[i] === userId) {
                hasPerms = true;
                perms = permissions[users[i]];
            }
        }
    }

    return perms;
};

bot.on("ready", function() {
    util.log(bot.user.username + " - (" + bot.user.id + ")");
});

bot.on("message", function(message) {
    if (message.content.search(/^!server/) > -1) {
        var messageArray = message.content.split(/^!server/);

        if (config.ownerid === message.author.id) {
            bot.reply(message, "Joining Server.");

            // call actual function
            bot.joinServer(messageArray[1], function(err, server) {
                if (err) {
                    util.log("Could not join server: " + err.message);
                } else {
                    bot.reply(message, "Joined server.");
                }
            });
        }
    } else if (message.content === "!reload") {
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["reload"];

        if (commandPerms) {
            bot.reply(message, "Reloading...");

            // call actual function
            refresh.refresh(function(err) {
                if (err === false) {
                    bot.reply(message, "Reloaded.");
                }
            });
        }
    } else if (message.content.search(/^!add/) > -1) {
        var messageArray = message.content.split(/^!add/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["add"];

        if (commandPerms) {

            // call actual function
            music.add(messageArray[1], function(err, info) {
                if (!err) {
                    if (info.isPlaylist) {
                        bot.reply(message, "Playlist with " + info.amountOfItems + " items processing. Any video that has been removed will be ignored.");
                    } else {
                        bot.reply(message, messageArray[1] + " added to queue at position " + info.pos + " ETA: " + info.when);
                    }
                }
            });
        }
    } else if (message.content.search(/^!play/) > -1) {
        var messageArray = message.content.split(/^!play/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["play"];

        if (commandPerms) {

            // call actual function
            music.play(function(err, msg) {
                if (err === false) {
                    //music.paused = false;
                    bot.reply(message, msg);
                }
            });
        }
    } else if (message.content.search(/^!pause/) > -1) {
        var messageArray = message.content.split(/^!pause/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["play"];

        if (commandPerms) {
            // call actual function
            music.pause(function(err, msg) {
                if (err === false) {
                    music.paused = true;
                    bot.reply(message, msg);
                }
            });
        }
    } else if (message.content.search(/^!skip/) > -1) {
        var messageArray = message.content.split(/^!skip/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["play"];

        if (commandPerms) {
            // call actual function
            music.skip(function(err, msg) {
                if (err === false) {
                    bot.reply(message, msg);
                }
            });
        }
    } else if (message.content.search(/^!summon/) > -1) {
        var messageArray = message.content.split(/^!summon/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["summon"];

        util.log(commandPerms);
        if (commandPerms) {

            // call actual function
            bot.joinVoiceChannel(message.author.voiceChannel, function(error, connection) {
                //if (error === false) {
                music.voiceConnection = connection;
                music.setVoiceConnection(connection);
                bot.reply(message, "Voice channel" + message.author.voiceChannel + " joined.");
                //}
            });
        }
    } else if (message.content.search(/^!echo/) > -1) {
        var messageArray = message.content.split(/^!echo/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        if (config.ownerid === message.author.id) {
            // call actual function
            bot.reply(message, messageArray[1]);
        }
    } else if (message.content.search(/^!queue/) > -1) {
        var messageArray = message.content.split(/^!queue/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["queue"];

        if (commandPerms) {

            // call actual function
            music.getQueue(function(err, msg) {
                if (err === false) {
                    bot.reply(message, msg);
                }
            });
        }
    } else if (message.content.search(/^!np/) > -1) {
        var messageArray = message.content.split(/^!np/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["nowPlaying"];

        if (commandPerms) {

            // call actual function
            music.getNowPlaying(function(err, msg) {
                if (err === false) {
                    bot.reply(message, msg);
                }
            });
        }
    } else if (message.content.search(/^!shuffle/) > -1) {
        var messageArray = message.content.split(/^!shuffle/);
        // check permissions of user
        var perms = getPermissions(message.author.id);
        var commandPerms = perms["nowPlaying"];

        if (commandPerms) {

            // call actual function
            music.shuffle(function(err, msg) {
                if (music.downloading === true) {
                    bot.reply(message, "Some songs are still downloading. Wait a bit before trying to shuffle again.");
                } else if (err === false) {
                    bot.reply(message, "Shuffled! New queue is: " + msg);
                }
            });
        }
    }
});

exports.requireCtx = require;