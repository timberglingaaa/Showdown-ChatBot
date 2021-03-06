/**
 * Bot Module: Core
 */

'use strict';

const Path = require('path');
const RoomManager = require(Path.resolve(__dirname, 'rooms.js'));

function setup(App) {
	if (!App.config.modules.core) {
		App.config.modules.core = {
			nick: '',
			pass: '',
			avatar: '',
			rooms: [],
			privaterooms: [],
		};
	}

	const CoreMod = {};

	let lastLogin = CoreMod.lastLogin = {nick: '', named: false};

	let manager = CoreMod.manager = new RoomManager(Path.resolve(App.confDir, 'rooms/'));
	CoreMod.loginTimer = null;

	function execInitCmds() {
		let cmds = [];
		for (let mod in App.modules) {
			if (App.modules[mod].system && typeof App.modules[mod].system.getInitCmds === 'function') {
				cmds = cmds.concat(App.modules[mod].system.getInitCmds());
			}
		}
		if (cmds.length) {
			App.bot.send(cmds);
		}
	}

	function setLoginTimer(time) {
		CoreMod.loginTimer = setTimeout(() => {
			CoreMod.loginTimer = null;
			App.logToConsole("Login Timeout. Retrying in 5 seconds");
			App.log("[Bot Core] Login Timeout. Retrying in 5 seconds");
			App.bot.retryRename(5000, App.config.modules.core.nick, App.config.modules.core.pass);
		}, time);
	}

	App.bot.on('updateuser', (nick, named) => {
		if (named && CoreMod.loginTimer) {
			clearTimeout(CoreMod.loginTimer);
			CoreMod.loginTimer = null;
		}
		if (!lastLogin.named && named) {
			/* First login - Join the rooms */
			let rooms = [];
			rooms = rooms.concat(App.config.modules.core.rooms || []);
			let tempRooms = App.config.modules.core.privaterooms || [];
			for (let i = 0; i < tempRooms.length; i++) {
				if (rooms.indexOf(tempRooms[i]) < 0) {
					rooms.push(tempRooms[i]);
				}
			}
			tempRooms = manager.getRooms();
			for (let i = 0; i < tempRooms.length; i++) {
				if (rooms.indexOf(tempRooms[i]) < 0) {
					rooms.push(tempRooms[i]);
				}
			}
			let cmds = [];
			for (let i = 0; i < rooms.length; i++) {
				cmds.push('|/join ' + rooms[i]);
			}
			if (App.config.modules.core.avatar) {
				cmds.push('|/avatar ' + App.config.modules.core.avatar);
			}
			if (cmds.length) {
				App.bot.send(cmds).then(execInitCmds);
			} else {
				execInitCmds();
			}
		}
		lastLogin.nick = nick;
		lastLogin.named = named;
		App.logToConsole('Nick Changed: ' + nick);
		App.log('[Bot Core] Nick Changed: ' + nick);
	});

	App.bot.on('renamefailure', err => {
		if (lastLogin.named) return;
		if (!App.bot.isConnected()) return;
		if (CoreMod.loginTimer) {
			clearTimeout(CoreMod.loginTimer);
			CoreMod.loginTimer = null;
		}
		if (err === 'wrongpassword') {
			App.logToConsole("Login Error: Wrong password.");
			App.log("[Bot Core] Login Error: Wrong password.");
		} else if (App.config.modules.core.nick) {
			App.logToConsole("Login Error: Heavy Load / Connection error. Retrying in 5 seconds");
			App.log("[Bot Core] Login Error: Heavy Load / Connection error. Retrying in 5 seconds");
			App.bot.retryRename(5000, App.config.modules.core.nick, App.config.modules.core.pass);
			setLoginTimer(35 * 1000);
		}
	});

	App.bot.on('challstr', () => {
		if (App.config.modules.core.nick) {
			App.logToConsole('Logging into ' + App.config.modules.core.nick + '...');
			setLoginTimer(30 * 1000);
			App.bot.rename(App.config.modules.core.nick, App.config.modules.core.pass);
		}
	});

	App.bot.on('roomjoin', (room, type) => {
		if (type === 'chat') {
			manager.joinRoom(room);
		}
	});

	App.bot.on('roomleave', room => {
		manager.leaveRoom(room);
	});

	App.bot.on('roomjoinfailure', room => {
		manager.leaveRoom(room);
	});

	App.bot.on('send', msg => {
		if (App.config.debug) {
			App.logToConsole('SENT: ' + msg);
		}
	});

	App.bot.on('line', (room, msg) => {
		if (App.config.debug) {
			App.logToConsole('LINE: ' + msg);
		}
	});

	App.server.setPermission('core', 'Permission for changing the bot autojoin and login configuration');

	return CoreMod;
}

exports.setup = setup;
