const Discord = require("discord.js");
const config = require("./config.json");
const utils = require('./utilities/utils.js');
const base = require('./utilities/basebot.js');
const dscp = require('./utilities/dscpcmds.js');
const autow = require('./utilities/autowarning.js');
const mbot = require('./utilities/modbot.js');
const stats = require('./utilities/stattrack.js');
const moment = require("moment");
const shell = require('shelljs');
const fs = require("fs");
const mysql = require("mysql");
const { exec } = require("child_process");
const { inspect } = require('util');
const SteamAPI = require('steamapi');
const bot = require('../CorruptionBot.js')

module.exports.run = async (client, message, args, sqlcon) => {
    sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${message.guild.id}'`, (err, rows) => {
        if (err) bot.console(err)
        if (message.member.hasPermission("ADMINISTRATOR") || message.member.roles.find(role => role.id === rows[0].Adminrole)) {
            if (args[0] === undefined) return message.channel.send("Please specify a new prefix!");
            sqlcon.query(`UPDATE guildprefs SET Prefix = '${args[0]}' WHERE GuildID = '${message.guild.id}'`)

        }
    })
    setTimeout(function () {
        sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${message.guild.id}'`, (err, prefix) => {
            message.guild.members.get(client.user.id).setNickname(`Corruption (${prefix[0].Prefix})`);
            message.channel.send(`The new bot prefix is ${prefix[0].Prefix}`);

        })
    }, 500);
}
module.exports.config = {
    name: "prefix",
    aliases: ["p"],
    info: "Changes the bot's prefix",
    type: "mod"
}