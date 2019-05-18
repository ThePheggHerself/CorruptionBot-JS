const Discord = require("discord.js");
const client = new Discord.Client();
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
const steam = new SteamAPI(config.SteamAIPKey);

let modulelist = "";
client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();


fs.readdir("./commands/", (err, files) => {
	if (err) console.log(err)
	let jsfile = files.filter(f => f.split(".").pop() === "js");
	if (jsfile.length <= 0) {
		console.log(`Couldn't find commands.`);
	}
	jsfile.forEach((f, i) => {
		delete require.cache[require.resolve(`./commands/${f}`)];
		let props = require(`./commands/${f}`);
		let commandlist = f.split(".")
		modulelist += `${commandlist[0]}, `
		client.commands.set(props.config.name, props);
		props.config.aliases.forEach(alias => {
			client.aliases.set(alias, props.config.name)
		})
	});
	console.log(modulelist);
});
var sqlcon = mysql.createConnection({
	host: config.CBotHost,
	user: config.CBotUser,
	password: config.CBotPass,
	database: config.CBotDB,
	charset: 'utf8mb4'
});
sqlcon.connect(err => {
	if (err) throw err;
	console.log("Connected To Database");
})
sqlcon.on('error', error => {
	if (error.code === 'PROTOCOL_CONNECTION_LOST') {
		sqlcon = mysql.createConnection({
			host: config.CBotHost,
			user: config.CBotUser,
			password: config.CBotPass,
			database: config.CBotDB,
			charset: 'utf8mb4'
		});
	} else console.log(error)
})
const play_act = [
	`with the help command`,
	`with my code`,
	`with the testers`,
	`with Phoenix--Project`,
	`Half-Life 3`,
	`with random people`,
	`with your mind`,
	`the waiting game`,
	`Portal 3`,
	`The good Fallout 4`,
	`Tetris`,
	`Snake`,
	`Pong`,
	`Tennis`,
	`World domination`
];

client.on("ready", () => {

	const remote = `https://github.com/PhoenProject/Corruption`;
	require('simple-git')()
		.addConfig('user.name', 'PhoenProject')
		.addConfig('user.email', config.GitEmail)
		.clean("-f -n")
		.stash()
		//.silent(true)
		.fetch(remote, "master")
		.exec(() => console.log('finished'));

	let GCount = client.guilds
	let UCount = 0
	GCount.forEach(element => {
		UCount = UCount + element.memberCount
	});
	client.guilds.find(guild => guild.id === "446745542740148244").channels.find(channel => channel.id === "557285986833530882").send("**CORRUPTION BOT ONLINE**")
	let cmessage = `Bot has started, with ${UCount} users, in ${client.guilds.size} guilds.`;
	client.user.setPresence({ game: { name: "myself start up", type: "WATCHING" } })
	setInterval(() => {
		const index = Math.floor(Math.random() * (play_act.length - 1) + 1);
		client.user.setPresence({ game: { name: play_act[index], type: "PLAYING" } });
	}, 120000);
	utils.Console(cmessage, client)

	setInterval(() => {
		if (moment().isoWeekday().toString() === '7') {
			if (moment().format("HH:mm").toString() == "23:59") {
				sqlcon.query(`UPDATE stafflist SET PlayTime = '0'`)
			}
		}
	}, 40000)


});
client.on("guildCreate", guild => {
	let cmessage = `New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`;
	utils.Console(cmessage, client)

	sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${guild.id}'`, (err, rows) => {
		if (err) throw err
		if (rows.length < 1) {
			CreateGuildPrefs(guild, sqlcon)
		}
	})
});
client.on("guildDelete", guild => {
	let cmessage = `I have been removed from: ${guild.name} (id: ${guild.id})`;
	utils.Console(cmessage, client)
});
client.on("guildMemberAdd", member => {
	sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${member.guild.id}'`, (err, rows) => {
		if (err) throw err
		if (rows[0].MemLog === 'true') {
			let mlogchannel = member.guild.channels.find((channel => channel.id === rows[0].MemLogChan));
			if (mlogchannel) { AddGuildMember(member, mlogchannel) }
			else if (!mlogchannel) { }
		}
		else if (rows[0].AntiRaid === '1') { AntiRaid(member) }
	})
});
client.on("guildMemberRemove", member => {
	sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${member.guild.id}'`, (err, rows) => {
		if (err) throw err
		if (rows[0] != undefined) {
			if (rows[0].MemLog === 'true') {
				let mlogchannel = member.guild.channels.find((channel => channel.id === rows[0].MemLogChan));
				if (mlogchannel) {
					let Bot = member.guild.members.get(member => member.id === client.user.id)
					const sInfo = new Discord.RichEmbed()
						.setTitle(`Member has left the guild`)
						.setAuthor(`${member.displayName}`)
						.setColor(member.displayHexColor)
						.setFooter(`User ID: ${member.id}`)
						.setTimestamp()
						.setThumbnail(member.user.avatarURL)
						.addField("Total members", `${member.guild.memberCount}`, true)
					mlogchannel.send(sInfo)
				}
				else if (!mlogchannel) { }
			}
		}
	})
});
client.on("guildMemberUpdate", function (oldMem, newMem) {
	sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${oldMem.guild.id}'`, (err, rows) => {
		if (err) throw err
		if (rows[0] != undefined) {
			if (rows[0].MemLog === 'true' && oldMem.nickname != newMem.nickname) {
				let mlogchannel = oldMem.guild.channels.find((channel => channel.id === rows[0].MemLogChan));
				let member = oldMem.user
				const sInfo = new Discord.RichEmbed()
					.setAuthor(`${member.tag} - Nickname Updated`, oldMem.user.avatarURL)
					.setColor(oldMem.displayHexColor)
					.setTimestamp()
				if (oldMem.nickname === null) sInfo.addField("Old nickname", "None")
				else sInfo.addField("Old nickname", oldMem.nickname)
				if (newMem.nickname === null) sInfo.addField("New nickname", "None")
				else sInfo.addField("New nickname", newMem.nickname)
				mlogchannel.send(sInfo).catch(O_o => { });
			}
		}
	})
});
client.on("messageDelete", async message => {
	if (!message.guild) return
	else {
		let logs = await message.guild.fetchAuditLogs({ type: 72 }).catch(error => {
			let cmessage = error;
			utils.Console(cmessage, client)
		});
		let entry = logs.entries.first();

		sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${message.guild.id}'`, (err, rows) => {
			if (err) throw err
			if (message.mentions.members.first() != undefined && message.mentions.users.first().id != message.author.id
				&& !message.mentions.users.first().bot && entry.createdTimestamp < (Date.now() - 5000))
				return message.channel.send(`Damn son, ${message.author} ghost pinged ${message.mentions.members.first()}`)

			MessageDelete(message, entry, rows)
		})
	}
});
client.on("messageUpdate", function (oldMSG, newMSG) {
	if ((!oldMSG.guild || !oldMSG.channel) || (oldMSG.content === newMSG.content)) return
	else if (oldMSG.guild && oldMSG.channel.type != "dm") {
		sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${oldMSG.guild.id}'`, (err, rows) => {
			if (err) throw err
			if (rows[0].MsgLog === 'true') {
				if (oldMSG != newMSG && oldMSG != null && newMSG != null && !newMSG.author.bot && (oldMSG.member != null && !newMSG.member != null)) {
					let mlogchannel = oldMSG.guild.channels.find((channel => channel.id === rows[0].MsgLogChan));
					if (mlogchannel) {
						if (newMSG === null) newMSG = "This message shouldn't be displayed!\nIf it is, then something has gone massively wrong!"
						let color = oldMSG.member.displayHexColor
						if (color === null) color = "#e450f4"
						if (newMSG.toString().length > 1024) newMSG = newMSG.toString().slice(1023)
						const sInfo = new Discord.RichEmbed()
							.setAuthor(`${newMSG.member.tag} - Message Edited`, newMSG.author.avatarURL)
							.setDescription(oldMSG)
							.setColor(color)
							.setTimestamp()
							.addField("New message:", `${newMSG}`)
							.addField("Channel", newMSG.channel)
						mlogchannel.send(sInfo).catch(O_o => { });
					}
				}
			}
		})
	}
});
client.on("message", async message => {
	let args = message.content.split(' ')
	if (message.author.bot || message.member == null || message.author == null) return
	else if (!message.guild && message.author.id === config.ownerID) {
		let MsgContent = message.content.split(' ')
		if (MsgContent[0] === `${config.prefix}say`) {
			let Guild = client.guilds.find(guild => guild.id === MsgContent[1]);
			let Channel = Guild.channels.find(channel => channel.id === MsgContent[2]);
			if (Guild === null) return message.reply("I was unable to find that guild");
			else {
				let Channel = Guild.channels.find(channel => channel.id === MsgContent[2]);
				if (Channel === null) return message.reply("I was unable to find that channel");
				else {
					let sMessage = MsgContent.slice(3).join(' ');
					Channel.send(sMessage)
				}
			}
		}
	}
	else if (message.mentions.users.first() != undefined && message.mentions.users.first().id === client.user.id && args[1] === "help") {
		sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${message.guild.id}'`, (err, PrefixCheck) => {
			PingMessage(message, PrefixCheck)
		})
	}
	else {
		sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${message.guild.id}'`, (err, sqlguild) => {
			autow.globalfilter(client, message, sqlcon)
			autow.filter(client, message, sqlcon)
			autow.massping(client, message, sqlcon)

			MessageCheck(message, sqlguild, sqlcon)
		});
	}
});

client.on("debug", debug => {
	try {
		let Bot = client.guilds.find(guild => guild.id === "446745542740148244").members.find(member => member.id === client.user.id)
		let debugembed = new Discord.RichEmbed()
			.setAuthor('Corruption Developer log', client.user.avatarURL)
			.setColor(Bot.displayHexColor)
			.setTimestamp()
			.setFooter("Debug for Corruption Bot")
			.addField("Debug", debug);
		client.guilds.find(guild => guild.id === "446745542740148244").channels.find(channel => channel.id === "557285986833530882").send(debugembed)
	}
	catch { console.log(debug) }
});
client.on("warn", warn => {
	let Bot = client.guilds.find(guild => guild.id === "446745542740148244").members.get(member => member.id === client.user.id)
	let warnembed = new Discord.RichEmbed()
		.setAuthor('Corruption Developer log', client.user.avatarURL)
		.setColor(Bot.displayHexColor)
		.setTimestamp()
		.setFooter("Warning for Corruption Bot")
		.addField("Warning", warn);
	client.guilds.find(guild => guild.id === "446745542740148244").channels.find(channel => channel.id === "557285986833530882").send(warnembed)
});
client.on("error", error => {
	let Bot = client.guilds.find(guild => guild.id === "446745542740148244").members.get(member => member.id === client.user.id)
	let errorembed = new Discord.RichEmbed()
		.setAuthor('Corruption Developer log')
		.setColor('#e450f4')
		.setTimestamp()
		.setFooter("Error report for Corruption Bot")
		.addField("Error", error.message);
	if (!error.message.includes("ECONNRESET")) { client.guilds.find(guild => guild.id === "446745542740148244").channels.find(channel => channel.id === "557285986833530882").send("<@&538368441929826304>") }
	client.guilds.find(guild => guild.id === "446745542740148244").channels.find(channel => channel.id === "557285986833530882").send(errorembed)
});
client.on('disconnect', () => console.log('I just disconnected, making sure you know, I will reconnect now...'));
client.on('reconnecting', () => console.log('I am reconnecting now!'));

//Handle Message
function MessageCheck(message, sqlguild, sqlcon) {
	if (sqlguild.length < 1) {
		let guild = message.guild
		CreateGuildPrefs(guild, sqlcon)
	}
	else {
		sqlcon.query(`SELECT * FROM chanprefs WHERE GuildID = '${message.guild.id}' AND ChannelID = '${message.channel.id}'`, (err, sqlchannelcreate) => {
			if (err) throw err
			if (sqlchannelcreate.length < 1) { CreateChanPrefs(message, sqlcon) }
			sqlcon.query(`SELECT * FROM chanprefs WHERE GuildID = '${message.guild.id}' AND ChannelID = '${message.channel.id}'`, (err, sqlchannel) => {
				if (err) throw err
				if (!message.content.startsWith(sqlguild[0].Prefix) && sqlchannel[0].MsgVote === 'true') { MsgVoteChan(message, sqlcon, sqlguild) }
				else if (message.content.startsWith(sqlguild[0].Prefix)) {
					let Message = message.content.slice((sqlguild[0].Prefix).length);
					let MsgContent = Message.split(" ");
					let cmd = MsgContent[0]
					let args = MsgContent.slice(1);
					let commandfile = client.commands.get(cmd) || client.commands.get(client.aliases.get(cmd))
					if (message.guild.id === "403155047527088129") {
						switch (cmd) {
							case "onduty":
								dscp.onduty(client, message, MsgContent)
								break;
							case "offduty":
								dscp.offduty(client, message, MsgContent)
								break;
							case "access":
								dscp.access(client, message, MsgContent)
								break;
							case "tester":
								dscp.test(client, message, MsgContent)
								break;
							case "nsfw":
								dscp.nsfw(client, message, MsgContent)
								break;
							case "stats":
								stats.main(client, message)
								break;

							default:
								if ((message.channel.id === `529977537116241921`) && !message.author.bot) {
									mbot.AutoModLogChan(client, message, sqlcon)
								}
								else if ((message.channel.id === `452160531416219658` || message.channel.id === `413410295147528203`) && !message.author.bot) {
									mbot.CommandChans(client, message, sqlcon)
								}
								else if (message.channel.id === `519867312090644490` || message.channel.id === `473403553013301248` || message.channel.id === `473400727717281793`) {
									mbot.ServerLogsChan(client, message, sqlcon)
								}
								break;
						}
					}
					switch (cmd) {
						case "help":
							sqlcon.query(`SELECT * FROM guildprefs WHERE GuildID = '${message.guild.id}'`, (err, rows) => { Help(message, rows) })
							break;
						case "ping":
							PingCommand(message)
							break;
						case "contact":
							ContactCommand(client, message, args)
							break;
						case "reload":
							Reloadcommand(message)
							break;
						case "restart":
							Restart(message)
							break;
						default:
							if (commandfile) commandfile.run(client, message, args, sqlcon);
							break;
					}
				}
			})
		})
	}
}

///MySQL data creation
function CreateGuildPrefs(guild, sqlcon) {
	let strTest = guild.name.replace(/[^0-9a-z]/gi, '')
	let GuildName = strTest.replace(/'/g, '~');
	console.log(GuildName);
	sqlcon.query(`INSERT INTO guildprefs (GuildName, GuildID, MemLog, MemLogChan, MsgLog, MsgLogChan, Upvote, Downvote, ModRole, AdminRole, AntiRaid, Prefix)
VALUES ('${GuildName}','${guild.id}','false','null','false','null','👍','👎','none','none','false','?')`)
}
function CreateChanPrefs(message, sqlcon) {
	sqlcon.query(`INSERT INTO chanprefs (GuildID, ChannelID, MsgVote) VALUES ('${message.guild.id}', '${message.channel.id}', 'false')`)
	MsgVoteChan(message, sqlcon)
}

//Guild Member Functions
function AddGuildMember(member, mlogchannel) {
	let User = client.users.find(user => user.id === member.id);
	var cdate = moment(new Date(User.createdAt));
	let Guild = member.guild;
	let Bot = member.guild.members.get(member => member.id === client.user.id)
	const sInfo = new Discord.RichEmbed()
		.setTitle(`Member has joined the guild`)
		.setAuthor(`${member.displayName}`)
		.setColor('#e450f4')
		.setFooter(`User ID: ${member.id}`)
		.setTimestamp()
		.setThumbnail(member.user.avatarURL)
		.addField("Total members", `${Guild.memberCount}`, true)
		.addField("Creation Date:", `${cdate.format("MMMM Do YYYY HH:mm")}\n(${moment(cdate).fromNow()})`, true);
	let ageS = moment(cdate).fromNow(true)
	let ageA = ageS.split(" ");
	if (ageS.includes("seconds") || ageA[1] === "minutes" || ageA[1] === "hours" || ageA[1] === "days") {
		if (!member.guild.roles.find(role => role.name === "Anti-Alt")) {
			member.guild.createRole({
				name: "Anti-Alt",
				color: `#df6968`,
				hoist: false,
				position: 9,
				permissions: [],
				mentionable: false
			}).catch(error => { return member.reply(`Sorry, i was unable to execute that command. ${error}`) });
			setTimeout(function () {
				let Guild = member.guild
				let blarg = Guild.channels.filter(channel => channel.type === "text")
				blarg.forEach(f => {
					let mrole = member.guild.roles.find(role => role.name === "Anti-Alt").id
					f.overwritePermissions(mrole, {
						ATTACH_FILES: false,
						EMBED_LINKS: false,
						ADD_REACTIONS: false,
						USE_EXTERNAL_EMOJIS: false,
						CREATE_INSTANT_INVITE: false,
					})
				});
			});
		}
		sInfo.addField("WARNING!", "This account is less than 30 days old, so has been given the Anti-Alt role")
		let Role = member.guild.roles.find(role => role.name === "Anti-Alt")
		member.addRole(Role)
		member.send(`Thank you for joining ${member.guild.name}, but due to your account age, you have been given the Anti-Alt role which limits your permissions`)
		mlogchannel.send(sInfo)
	}
	else {
		mlogchannel.send(sInfo)
	}
}
function AntiRaid(member) {
	if (!member.guild.roles.find(role => role.name === "Anti-Raid")) {
		member.guild.createRole({
			name: "Anti-Raid",
			color: "LUMINOUS_VIVID_PINK",
			hoist: false,
			position: 9,
			permissions: [],
			mentionable: false
		}).catch(error => { return member.reply(`Sorry, i was unable to create the Anti-Raid role. ${error}`) });
		setTimeout(function () {
			let Guild = member.guild
			let blarg = Guild.channels.filter(channel => channel.type === "text")
			blarg.forEach(f => {
				let mrole = member.guild.roles.find(role => role.name === "Muted").id
				f.overwritePermissions(mrole, { SEND_MESSAGES: false, ADD_REACTIONS: false })
			});
			let role = member.guild.roles.find(role => role.name === "Muted");
			member.addRole(role).catch(O_o => { });
			member.send("This server currently has the anti-raid feature enabled, so all new members have been automatically muted!")
			member.addRole(role).catch(O_o => { });

		}, 500);
	}
	else {
		let role = member.guild.roles.find(role => role.name === "Anti-Raid");
		member.addRole(role).catch(O_o => { });
		member.send("This server currently has the anti-raid feature enabled, so all new members have been automatically muted!")
		member.addRole(role).catch(O_o => { });
	}
}

//Guild Message Functions
function MessageDelete(message, entry, rows) {
	let mlogchannel = message.guild.channels.find((channel => channel.id === rows[0].MsgLogChan));
	if (mlogchannel != null) {
		if (message.guild = null) return;
		else if (message.author.bot === true) return;
		const sInfo = new Discord.RichEmbed()
			.setAuthor(`${message.author.tag} - Deleted message`, message.author.avatarURL)
			.setColor(message.member.displayHexColor)
			.setTimestamp()
			.addField("Channel", message.channel, true);
		if (entry.createdTimestamp > (Date.now() - 5000)) sInfo.addField("Deleted By", entry.executor, true)
		if (message.attachments.first() !== undefined) {
			let aName = message.attachments.first().filename
			sInfo.addField("Attatchment", aName, true)
		}
		if (message.content) sInfo.setDescription(message.content)
		mlogchannel.send(sInfo).catch(O_o => { });
	}
}

//Chat Functions
function PingMessage(message, PrefixCheck) {
	let guildPrefix
	if (PrefixCheck.length < 1) { guildPrefix = config.prefix }
	else { guildPrefix = PrefixCheck[0].Prefix }
	message.channel.send('Hello, My prefix for this guild is `' + guildPrefix + '`'
		+ '\nIf you require assistance, please use the `' + guildPrefix + 'help` command!')
}
function MsgVoteChan(message, sqlcon, sqlguild) {
	if (sqlguild != undefined) {
		message.react(sqlguild[0].Upvote).catch(error => { utils.CatchError(message, error, cmdused) });
		setTimeout(function () {
			message.react(sqlguild[0].DownVote).catch(error => { utils.CatchError(message, error, cmdused) })
		}, 100);
	}
}

//Command functions
function PingCommand(message) {
	let cmdused = "ping"
	if (message.author.id === config.ownerID) {
		message.channel.send("Ping?").then((msg) => {
			msg.edit(`Pong! Latency is ${msg.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms`)
				.catch(error => { utils.CatchError(message, error, cmdused) });
		})
	}
	else message.channel.send("Pong!")
}
function ContactCommand(client, message, args) {
	if (message.member.hasPermission("ADMINISTRATOR")) return base.Contact(client, message, args)
	else message.channel.send("Sorry, but you do not meet the requirements to use this command.")
}
function Reloadcommand(message) {
	if (message.author.id === config.ownerID) {
		message.channel.send("Reloading the command modules files now. Please wait...")
		modulelist = "";
		fs.readdir("./commands/", (err, files) => {
			if (err) {
				let cmessage = err;
				utils.Console(cmessage, client)
			};
			let jsfile = files.filter(f => f.split(".").pop() === "js");
			if (jsfile.length <= 0) {
				let cmessage = "Couldn't find commands.";
				utils.Console(cmessage, client)
			}
			jsfile.forEach((f, i) => {
				delete require.cache[require.resolve(`./commands/${f}`)];
				let props = require(`./commands/${f}`);
				let commandlist = f.split(".")
				modulelist += `${commandlist[0]}, `
				client.commands.set(props.config.name, props);
				props.config.aliases.forEach(alias => {
					client.aliases.set(alias, props.config.name)
				})
			});
			const reload = new Discord.RichEmbed()
				.setTitle("Corruption bot command reload", client.user.avatarURL)
				.setAuthor(`Corruption Bot`)
				.setColor(message.member.displayHexColor)
				.setFooter(`Corruption bot`)
				.setTimestamp()
				.addField("Loaded commands:", `${modulelist}`)
			let cmessage = `The bot commands have been reloaded.\n${modulelist}`;
			utils.Console(cmessage, client)

			message.channel.send(reload)
		});
	}
	else return
}
function Help(message, rows) {
	fs.readdir("./commands/", (err, files) => {

		let GeneralCMDs = ''
		let ModCMDs = ''
		let InfoCMDs = ''
		let gPrefix = rows[0].Prefix

		if (err) console.log(err)
		if (files.length < 1) return console.log("No files could be found!")
		let cmdFiles = files.filter(f => f.split(".").pop() === "js");
		cmdFiles.forEach((f, i) => {
			let props = require(`./commands/${f}`);

			switch (props.config.type) {
				case "info":
					InfoCMDs += `**${gPrefix}${f.replace('.js', '')}** - ${props.config.info}\n`
					break;
				case "mod":
					ModCMDs += `**${gPrefix}${f.replace('.js', '')}** - ${props.config.info}\n`
					break;
				case "general":
					GeneralCMDs += `**${gPrefix}${f.replace('.js', '')}** - ${props.config.info}\n`
					break;
				case "test":
					break;
			}
		})

		const help = new Discord.RichEmbed()
			.setAuthor(`Corruption Bot help guide`, client.user.avatarURL)
			.setDescription(`Help guide for Corruption discord bot`)
			.setColor(message.member.displayHexColor)
			.setFooter(`Do ${gPrefix}command for more info on a specific command, including required permissions.`)
			.addField(`**__Info commands__**`, InfoCMDs)
			.addField(`**__Moderation commands__**`, ModCMDs)
			.addField(`**__General commands__**`, GeneralCMDs)
		if (message.guild.id === '403155047527088129') {
			let DGuard = message.guild.roles.find(role => role.name === "Dragon Guard").id
			let ODuty = message.guild.roles.find(role => role.name === "Off Duty").id
			if (message.member.roles.find(role => role.id === ODuty) || message.member.roles.find(role => role.id === DGuard)) {
				help.addField("**__DragonSCP Commands__**",
					`**${gPrefix}offduty** - Replaces the Dragon Guard role with Off Duty.`
					+ `\n**${gPrefix}onduty** - Replaces the Off Duty role with Dragon Guard.`)
			};
		};
		message.author.send(help)
	})
}
function Restart(message) {
	if (message.author.id === config.ownerID) {
		const filter = m => m.author.id === message.author.id
		message.channel.send("Are you 100% sure you want to restart the bot?")
		message.channel.awaitMessages(filter, { max: 1, time: 35000, errors: ['time'] }).then((Confirmation) => {
			if (Confirmation.first().toString().toLowerCase() === "yes") {

				var spawn = exec('node CorruptionBot.js', {
					detached: true
				})
				process.exit()
				//shell.exec("chmod +x  ./restart.sh")
				//process.exit()
			}
			else if (Confirmation.first().toString().toLowerCase() === "no") {
				message.channel.send("Restart Aborted!");
			}
		})
	}
}


client.login(config.token);