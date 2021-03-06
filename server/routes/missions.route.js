const express = require('express');
const Mission = require('../models/mission.model');
const User = require('../models/discordUser.model');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const { requireMissionMaker } = require('../middleware/middlewares');
const { isMissionAuthor } = require('../middleware/middlewares');
const { requireAdmin } = require('../middleware/middlewares');
const { requireLogin } = require('../middleware/middlewares');
const {
	postDiscordReport,
	postDiscordReview,
	postDiscordUpdate,
	postDiscordEdit,
	postDiscordNewMission,
	postDiscordAskForReview,
	postMissionCopiedRemovedToServer,
	postNewMissionHistory,
	postNewAAR,
	postMissionAuditSubmited
} = require('../discord-poster');
const { getDiscordUserFromCookies } = require('../misc/validate-cookies');

REMOVE_FROM_MAIN = 'remove_from_main';
REMOVE_FROM_TEST = 'remove_from_test';
REMOVE_ARCHIVE = 'remove_archive';
COPY_TO_TEST = 'copy_to_test';
COPY_TO_MAIN = 'copy_to_main';
MARK_AS_READY = 'mark_as_ready';
ASK_FOR_REVIEW = 'ask_for_review';
SUBMIT_AUDIT = 'submit_audit';

REVIEW_STATE_PENDING = 'review_pending';
REVIEW_STATE_REPROVED = 'review_reproved';
REVIEW_STATE_ACCEPTED = 'review_accepted';
REVIEW_STATE_ACCEPTS_WITH_CAVEATS = 'review_accepted_with_caveats';

fileFilterFunction = async function (req, file, callback) {
	req.missionDataErrors = validateData(req.body, true);
	if (Object.keys(req.missionDataErrors).length > 0) {
		callback(null, false);
		return;
	}
	if (file.mimetype !== 'application/octet-stream') {
		req.missionDataErrors.file = 'File is not a .pbo.';
		callback(null, false);
		return;
	} else {
		const originalNameArray = file.originalname.split('.');
		const format = originalNameArray[originalNameArray.length - 1];
		if (format !== 'pbo') {
			req.missionDataErrors.file = 'File is not a pbo.';
			callback(null, false);
			return;
		} else if (
			fs.existsSync(
				`${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${file.originalname}`
			)
		) {
			req.missionDataErrors.misc =
				'A mission with this filename already exists.';
			callback(null, false);
			return;
		}
	}
	req.file = file;
	callback(null, true);
};

const uploadMulter = multer({
	limits: { fieldSize: 25 * 1024 * 1024 },
	fileFilter: fileFilterFunction,
	storage: multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, `${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}`);
		},
		filename: function (req, file, cb) {
			cb(null, req.body.fileName);
		}
	})
});

updateFileFilterFunction = async function (req, file, callback) {

	req.missionDataErrors = validateData(req.body, false);
	if (file.mimetype !== 'application/octet-stream') {
		req.missionDataErrors.file = 'File is not a .pbo.';
		callback(null, false);
		return;
	} else {
		const originalNameArray = file.originalname.split('.');
		const format = originalNameArray[originalNameArray.length - 1];
		if (format !== 'pbo') {
			req.missionDataErrors.file = 'File is not a pbo.';
			callback(null, false);
			return;
		} else if (
			fs.existsSync(
				`${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${file.fileName}`
			)
		) {
			req.missionDataErrors.misc =
				'A mission with this filename already exists.';
			callback(null, false);
			return;
		}
	}
	req.file = file;
	callback(null, true);
};

const updateMulter = multer({
	limits: { fieldSize: 10 * 1024 * 1024 }, //10mb
	fileFilter: updateFileFilterFunction,
	storage: multer.diskStorage({
		destination: function (req, file, cb) {
			console.log('COPYING MISSION UPDATE | destination METHOD');
			console.log(req.body.fileName);
			try {
				cb(null, `${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}`);
			} catch (e) {
				console.log('ERROR: ');
				console.log(e);
			}
		},
		filename: function (req, file, cb) {
			console.log('COPYING MISSION UPDATE | destination METHOD');
			console.log(req.body.fileName);
			try {
				cb(null, req.body.fileName);
			} catch (e) {
				console.log('ERROR: ');
				console.log(e);
			}
		}
	})
});

function validateData(reqBody, isNewMission) {
	const errors = {};
	if (!reqBody.authorID) {
		errors.authorID = 'Missing authorID.';
	}
	if (isNewMission && !reqBody.name) {
		errors.name = 'Missing name.';
	}

	if (!reqBody.terrain) {
		errors.terrain = 'Missing terrain.';
	}
	const validMissionTypes = ['COOP', 'TVT', 'COTVT', 'LOL', 'TRAINING'];
	if (!reqBody.type) {
		errors.type = 'Missing mission type.';
	} else if (!validMissionTypes.includes(reqBody.type)) {
		errors.type = 'Invalid mission type.';
	}
	if (!reqBody.size) {
		errors.size = 'Missing size.';
	}
	if (!reqBody.description) {
		errors.description = 'Missing description.';
	}
	if (!reqBody.tags) {
		errors.tags = 'Missing tags.';
	}
	if (!reqBody.timeOfDay) {
		errors.timeOfDay = 'Missing timeOfDay.';
	}
	if (!reqBody.era) {
		errors.era = 'Missing era.';
	}
	if (!reqBody.lastVersion) {
		errors.version = 'Missing Version.';
	}
	if (!reqBody.updates) {
		errors.updates = 'Missing Updates Array.';
	}
	if (!reqBody.fileName) {
		errors.fileName = 'Missing Filename.';
	}
	return errors;
}

function insertMissionOnDatabase(mission, query) {
	const options = {
		upsert: true,
		safe: true,
		new: true
	};
	Mission.findOneAndUpdate(query, mission, options, (err, doc) => {
		if (err) {
			console.log(err);
		}
	});
}

async function insertUserOnDatabase(user, query, missionID) {
	const options = {
		upsert: true,
		safe: true,
		new: true
	};
	User.findOneAndUpdate(query, user, options, (err, userData) => {
		if (err) {
			console.log(err);
		} else {
			if (!userData.missions) {
				userData.missions = [missionID];
				userData.save((error2) => {
					if (error2) {
						console.log(err);
					}
				});
			} else {
				if (userData.missions.indexOf(missionID) === -1) {
					userData.missions.push(missionID);
					userData.save((error2) => {
						if (error2) {
							console.log(err);
						}
					});
				}
			}
		}
	});
}

// upload mission
router.post(
	'/',
	[requireLogin, requireMissionMaker, uploadMulter.single('fileData')],
	(req, res) => {
		if (Object.keys(req.missionDataErrors).length > 0) {
			return res
				.status(400)
				.send({ missionErrors: req.missionDataErrors });
		}

		postDiscordNewMission(req.body);

		const firstUpdate = {
			version: req.body.updates[0].version,
			authorID: req.body.updates[0].authorID,
			date: req.body.updates[0].date,
			fileName: req.body.updates[0].fileName,
			changeLog: req.body.updates[0].changeLog
		};

		const mission = {
			uniqueName: req.body.uniqueName,
			name: req.body.name,
			authorID: req.body.authorID,
			terrain: req.body.terrain,
			type: req.body.type,
			size: req.body.size,
			description: req.body.description,
			jip: req.body.jip,
			respawn: req.body.respawn,
			tags: req.body.tags,
			timeOfDay: req.body.timeOfDay,
			era: req.body.era,
			uploadDate: Date.now(),
			lastUpdate: Date.now(),
			updates: [firstUpdate],
			lastVersion: req.body.lastVersion,
			reports: req.body.reports,
			reviews: req.body.reviews
		};
		if (req.body.ratios) {
			mission.ratios = req.body.ratios;
		}
		if (req.body.image) {
			mission.image = req.body.image;
		}
		const query = { uniqueName: req.body.uniqueName };
		insertMissionOnDatabase(mission, query);

		const user = {
			discordId: req.discordUser.user.id,
			username: req.discordUser.user.username,
			avatar: req.discordUser.user.displayAvatarURL()
		};
		const userQuery = { discordId: req.discordUser.user.id };
		insertUserOnDatabase(user, userQuery, req.body.uniqueName);

		return res.send({ ok: true });
	}
);

// lists all missions
router.get('/', [requireLogin], async (req, res) => {
	Mission.find({}, { _id: 0, image: 0 }, async (err, doc) => {
		if (err) {
			res.status(500).send(err);
		} else {
			return doc;
		}
	})
		.lean()
		.then((missions) => {
			missions.forEach((mission) => {
				if (mission && mission.updates) {
					mission.updates.forEach((update) => {
						update.main = fs.existsSync(
							`${process.env.ROOT_FOLDER}/${process.env.MAIN_SERVER_MPMissions}/${update.fileName}`
						);
						update.test = fs.existsSync(
							`${process.env.ROOT_FOLDER}/${process.env.TEST_SERVER_MPMissions}/${update.fileName}`
						);

						update.archive = fs.existsSync(
							`${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${update.fileName}`
						);
					});
				}
			});
			res.json(missions);
		})
		.catch((err) => {
			console.log('err: ', err);
			res.status(500).send(err);
		});
});

//get mission by uniqueName
router.get('/:uniqueName', [requireLogin], async (req, res) => {
	res.header('ETag', null);
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');

	Mission.findOne({ uniqueName: req.params.uniqueName }, (err, doc) => {
		if (err) {
			return res.status(500).send(err);
		} else {
			return doc;
		}
	})
		.lean()
		.then((mission) => {
			if (mission && mission.updates) {
				mission.updates.forEach((update) => {
					update.main = fs.existsSync(
						`${process.env.ROOT_FOLDER}/${process.env.MAIN_SERVER_MPMissions}/${update.fileName}`
					);

					update.test = fs.existsSync(
						`${process.env.ROOT_FOLDER}/${process.env.TEST_SERVER_MPMissions}/${update.fileName}`
					);

					update.archive = fs.existsSync(
						`${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${update.fileName}`
					);
				});
			}
			res.json(mission);
		})
		.catch((err) => {
			console.log('err: ', err);
			res.status(500).send(err);
		});
});

router.put('/report', [requireLogin, uploadMulter.none()], async (req, res) => {
	const options = {
		upsert: false,
		safe: true
	};

	let query = {};
	if (req.discordUser.isAdmin()) {
		query = {
			uniqueName: req.body.uniqueName,
			'reports._id': req.body.data._id
		};
	} else {
		query = {
			uniqueName: req.body.uniqueName,
			'reports._id': req.body.data._id,
			'reports.authorID': req.discordUser.user.id
		};
	}

	Mission.findOneAndUpdate(
		query,
		{
			$set: {
				'reports.$.report': req.body.data.report,
				'reports.$.version': req.body.data.version
			}
		},
		options,
		(err, missionData) => {
			if (err) {
				return res.send({ ok: false });
			} else {
				return res.send({ ok: true });
			}
		}
	);
});

router.post(
	'/report',
	[requireLogin, uploadMulter.none()],
	async (req, res) => {
		const report = {
			version: req.body.data.version,
			authorID: req.body.data.authorID,
			date: req.body.data.date,
			report: req.body.data.report
		};
		if (req.body.data.log) {
			report.log = req.body.data.log;
		}
		const options = {
			upsert: true,
			safe: true,
			new: true
		};
		const query = { uniqueName: req.body.uniqueName };
		Mission.findOneAndUpdate(query, {}, options, (err, missionData) => {
			if (err) {
				console.log(err);
			} else {
				if (!missionData.reports) {
					missionData.reports = [report];
				} else {
					missionData.reports.push(report);
				}
				missionData.save((error2) => {
					if (error2) {
						console.log(error2);
					}
				});
				postDiscordReport(report, missionData);
				return res.send({ ok: true });
			}
		});
	}
);

router.put('/review', [requireLogin, uploadMulter.none()], async (req, res) => {
	const options = {
		upsert: false,
		safe: true
	};

	let query = {};
	if (req.discordUser.isAdmin()) {
		query = {
			uniqueName: req.body.uniqueName,
			'reviews._id': req.body.data._id
		};
	} else {
		query = {
			uniqueName: req.body.uniqueName,
			'reviews._id': req.body.data._id,
			'reviews.authorID': req.discordUser.user.id
		};
	}

	Mission.findOneAndUpdate(
		query,
		{
			$set: {
				'reviews.$.review': req.body.data.review,
				'reviews.$.version': req.body.data.version
			}
		},
		options,
		(err, missionData) => {
			if (err) {
				return res.send({ ok: false });
			} else {
				return res.send({ ok: true });
			}
		}
	);
});

router.post(
	'/review',
	[requireLogin, uploadMulter.none()],
	async (req, res) => {
		const review = {
			version: req.body.data.version,
			authorID: req.body.data.authorID,
			date: req.body.data.date,
			review: req.body.data.review
		};
		const options = {
			upsert: true,
			safe: true,
			new: true
		};
		const query = { uniqueName: req.body.uniqueName };
		Mission.findOneAndUpdate(query, {}, options, (err, missionData) => {
			if (err) {
				console.log(err);
			} else {
				if (!missionData.reviews) {
					missionData.reviews = [review];
				} else {
					missionData.reviews.push(review);
				}
				missionData.save((error2) => {
					if (error2) {
						console.log(error2);
					}
				});
				postDiscordReview(review, missionData);
				return res.send({ ok: true });
			}
		});
	}
);

router.delete(
	'/review/:uniqueName/:reviewId',
	[requireLogin],
	async (req, res) => {
		if (req.discordUser.isAdmin()) {
			Mission.updateOne(
				{ uniqueName: req.params.uniqueName },
				{
					$pull: {
						reviews: { _id: req.params.reviewId }
					}
				},
				{ safe: true }
			)
				.lean()
				.then((value) => {
					res.send({ ok: true });
				})
				.catch((err) => {
					console.log('err: ', err);
					res.status(500).send(err);
				});
		} else {
			res.status(401).send({
				authError: 'User not authorized.'
			});
		}
	}
);

router.delete(
	'/report/:uniqueName/:reportID',
	[requireLogin, requireAdmin],
	async (req, res) => {
		Mission.updateOne(
			{ uniqueName: req.params.uniqueName },
			{
				$pull: {
					reports: { _id: req.params.reportID }
				}
			},
			{ safe: true }
		)
			.lean()
			.then((value) => {
				res.send({ ok: true });
			})
			.catch((err) => {
				console.log('err: ', err);
				res.status(500).send(err);
			});
	}
);

router.post(
	'/update',
	[requireLogin, requireMissionMaker, updateMulter.single('fileData')],
	async (req, res) => {
		const update = {
			version: req.body.version,
			authorID: req.discordUser.user.id,
			date: req.body.date,
			changeLog: req.body.changeLog,
			fileName: req.body.fileName
		};

		// TODO Allow for mission makers to customize trusted users to update their missions
		let query;
		if (
			req.discordUser.roles.highest.id ===
			process.env.DISCORD_ADMIN_ROLE_ID
		) {
			query = {
				uniqueName: req.body.uniqueName
			};
		} else {
			query = {
				uniqueName: req.body.uniqueName,
				authorID: req.discordUser.user.id
			};
		}
		Mission.findOne(query, (err, missionData) => {
			if (err) {
				console.log(err);
			} else {
				if (missionData == null) {
					return res.status(401).send({
						authError: 'Not allowed.'
					});
				}
				missionData.updates.push(update);
				missionData.lastUpdate = update.date;
				missionData.lastVersion = update.version;
				missionData.save((error2) => {
					if (error2) {
						console.log(error2);
					}
				});
				postDiscordUpdate(update, missionData);
				return res.send({ ok: true });
			}
		});
	}
);

router.post(
	'/edit',
	[uploadMulter.none(), requireLogin, requireMissionMaker],
	async (req, res) => {
		const options = {
			upsert: false,
			safe: true,
			new: true
		};
		// TODO validate body
		// TODO Allow for mission makers to customize trusted users to update their missions
		let query;
		if (req.discordUser.isAdmin()) {
			query = {
				uniqueName: req.body.uniqueName
			};
		} else {
			query = {
				uniqueName: req.body.uniqueName,
				authorID: req.discordUser.user.id
			};
		}
		const edit = {
			size: req.body.size,
			type: req.body.type,
			description: req.body.description,
			jip: req.body.jip,
			respawn: req.body.respawn,
			tags: req.body.tags,
			timeOfDay: req.body.timeOfDay,
			era: req.body.era
		};
		if (req.body.image != null) {
			edit['image'] = req.body.image;
		}

		Mission.findOneAndUpdate(
			query,
			{
				$set: edit
			},
			options,
			(err, missionData) => {
				if (err) {
					console.log(err);
				} else {
					postDiscordEdit(edit, missionData);
					return res.send({ ok: true });
				}
			}
		);
	}
);

router.post(
	'/:uniqueName/action/copy_to_main',
	[requireAdmin],
	updateMulter.none(),
	async (req, res) => {
		const archivePath = `${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${req.body.filename}`;
		fs.copyFile(
			archivePath,
			`${process.env.ROOT_FOLDER}/${process.env.MAIN_SERVER_MPMissions}/${req.body.filename}`,
			fs.constants.COPYFILE_EXCL,
			(err) => {
				if (err) {
					console.log(err);
				} else {
					Mission.findOne({ uniqueName: req.body.uniqueName })
						.lean()
						.then((mission) => {
							postMissionCopiedRemovedToServer(
								req,
								mission,
								req.body.updateId,
								'Main',
								'copied to',
								'#36B1FF'
							);
							res.send({ ok: true });
						})
						.catch((err) => {
							console.log('err: ', err);
							res.status(500).send(err);
						});
				}
			}
		);
	}
);

router.post(
	'/:uniqueName/action/remove_from_main',
	[requireAdmin],
	updateMulter.none(),
	async (req, res) => {
		fs.unlink(
			`${process.env.ROOT_FOLDER}/${process.env.MAIN_SERVER_MPMissions}/${req.body.filename}`,
			(err) => {
				if (err) {
					console.log(err);
				} else {
					Mission.findOne({ uniqueName: req.body.uniqueName })
						.lean()
						.then((mission) => {
							postMissionCopiedRemovedToServer(
								req,
								mission,
								req.body.updateId,
								'Main',
								'removed from',
								'#295F87'
							);
							res.send({ ok: true });
						})
						.catch((err) => {
							console.log('err: ', err);
							res.status(500).send(err);
						});
				}
			}
		);
	}
);

router.post(
	'/:uniqueName/action/copy_to_test',
	[requireLogin],
	updateMulter.none(),
	async (req, res) => {
		const archivePath = `${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${req.body.filename}`;

		let match;
		if (req.discordUser.isAdmin()) {
			match = { uniqueName: req.body.uniqueName };
		} else {
			match = {
				uniqueName: req.body.uniqueName,
				authorID: req.discordUser.id
			};
		}

		Mission.findOne(match)
			.lean()
			.then((mission) => {
				fs.copyFile(
					archivePath,
					`${process.env.ROOT_FOLDER}/${process.env.TEST_SERVER_MPMissions}/${req.body.filename}`,
					fs.constants.COPYFILE_EXCL,
					(err) => {
						if (err) {
							console.log(err);
							return res.status(500).send(err);
						} else {
							postMissionCopiedRemovedToServer(
								req,
								mission,
								req.body.updateId,
								'Test',
								'copied to',
								'#DFFF27'
							);
							return res.send({ ok: true });
						}
					}
				);
			})
			.catch((err) => {
				console.log('err: ', err);
				return res.status(500).send(err);
			});
	}
);

router.post(
	'/:uniqueName/action/remove_from_test',
	[requireLogin],
	updateMulter.none(),
	async (req, res) => {
		let match;
		if (req.discordUser.isAdmin()) {
			match = { uniqueName: req.body.uniqueName };
		} else {
			match = {
				uniqueName: req.body.uniqueName,
				authorID: req.discordUser.id
			};
		}

		Mission.findOne(match)
			.lean()
			.then((mission) => {
				fs.unlink(
					`${process.env.ROOT_FOLDER}/${process.env.TEST_SERVER_MPMissions}/${req.body.filename}`,
					(err) => {
						if (err) {
							console.log(err);
						} else {
							postMissionCopiedRemovedToServer(
								req,
								mission,
								req.body.updateId,
								'Test',
								'removed from',
								'#718015'
							);
							return res.send({ ok: true });
						}
					}
				);
			})
			.catch((err) => {
				console.log('err: ', err);
				res.status(500).send(err);
			});
	}
);
router.post(
	'/:uniqueName/action/remove_archive',
	[requireAdmin],
	updateMulter.none(),
	async (req, res) => {
		fs.unlink(
			`${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${req.body.filename}`,
			(err) => {
				if (err) {
					console.log(err);
				} else {
					return res.send({ ok: true });
				}
			}
		);
	}
);

router.post(
	'/:uniqueName/action/ask_for_review',
	[requireLogin],
	updateMulter.none(),
	async (req, res) => {
		let match;
		if (req.discordUser.isAdmin()) {
			match = {
				uniqueName: req.body.uniqueName,
				'updates._id': req.body.updateId
			};
		} else {
			match = {
				uniqueName: req.body.uniqueName,
				authorID: req.discordUser.id,
				'updates._id': req.body.updateId
			};
		}

		Mission.findOneAndUpdate(
			match,
			{ $set: { 'updates.$.reviewState': REVIEW_STATE_PENDING } },
			{
				upsert: true,
				safe: true,
				new: true,
				strict: false
			}
		)
			.lean()
			.then((mission) => {
				postDiscordAskForReview(req, mission, req.body.updateId);
				return res.send({ ok: true });
			})
			.catch((err) => {
				console.log('err: ', err);
				return res.status(500).send(err);
			});
	}
);

router.get('/download/:filename', [requireLogin], async (req, res) => {
	fs.readFile(
		`${process.env.ROOT_FOLDER}/${process.env.ARCHIVE}/${req.params.filename}`,
		(err, data) => {
			if (err) {
				res.writeHead(404);
				res.end(JSON.stringify(err));
				return;
			}
			res.writeHead(200);
			res.end(data);
		}
	);
});

router.post('/:uniqueName/history', [requireAdmin], async (req, res) => {
	const history = req.body;

	Mission.findOne({ uniqueName: req.params.uniqueName }, (err, mission) => {
		mission.lastPlayed = history.date;
		if (history._id) {
			mission.history.id(history._id).set(history);
			postNewMissionHistory(req, mission, history, false);
		} else {
			mission.history.push(history);
			postNewMissionHistory(req, mission, history, true);
		}
		mission.save();
		return res.send({ ok: true }, 200);
	});
});

router.post('/:uniqueName/history/aar', [requireLogin], async (req, res) => {
	const leader = req.body.leader;
	if (leader.discordID !== req.discordUser.user.id) {
		return res.status(401).send({
			authError: 'User is not the leader'
		});
	}
	const historyID = req.body.historyID;
	const aar = req.body.aar;

	Mission.findOne({ uniqueName: req.params.uniqueName }, (err, mission) => {
		let history = mission.history.id(historyID);
		history.leaders.id(leader._id).aar = aar.trim();
		postNewAAR(req, mission, history.outcome, leader, aar.trim());
		mission.save();
		return res.send();
	});
});

router.put('/:uniqueName/votes/', [requireLogin], async (req, res) => {
	await Mission.findOneAndUpdate(
		{ uniqueName: req.params.uniqueName },
		{
			$addToSet: {
				votes: req.discordUser.user.id
			}
		}
	).exec();
	const user = await User.findOneAndUpdate(
		{ discordId: req.discordUser.user.id },
		{
			$addToSet: {
				votes: req.params.uniqueName
			}
		},
		{ upsert: true }
	).exec();
	console.log(user);
	return res.send({ ok: true });
});

router.delete('/:uniqueName/votes/', [requireLogin], async (req, res) => {
	res.header('ETag', null);
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');

	await Mission.findOneAndUpdate(
		{ uniqueName: req.params.uniqueName },
		{
			$pull: {
				votes: req.discordUser.user.id
			}
		}
	).exec();
	await User.findOneAndUpdate(
		{ discordId: req.discordUser.user.id },
		{
			$pull: {
				votes: req.params.uniqueName
			}
		}
	).exec();
	return res.send({ ok: true });
});

router.get('/votes/vote_count', [requireLogin], async (req, res) => {
	res.header('ETag', null);
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');

	const userWithVotes = await User.findOne(
		{ discordId: req.discordUser.user.id },
		{ votes: 1 }
	).exec();
	if (userWithVotes == null) {
		return res.send({ votes: [] });
	}
	return res.send(userWithVotes);
});

router.get('/votes/voted_missions', [requireLogin], async (req, res) => {
	res.header('ETag', null);
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');

	const votedMissions = await Mission.find({
		votes: { $exists: true, $type: 'array', $ne: [] }
	})
		.sort('votes')
		.exec();

	return res.send(votedMissions);
});

router.get(
	'/votes/reset_votes',
	[requireLogin, requireAdmin],
	async (req, res) => {
		req = await getDiscordUserFromCookies(
			req,
			'User not allowed to interact with missions'
		);

		await User.updateMany(
			{
				votes: { $exists: true, $type: 'array', $ne: [] }
			},
			{
				$set: {
					votes: []
				}
			}
		).exec();

		await Mission.updateMany(
			{
				votes: { $exists: true, $type: 'array', $ne: [] }
			},
			{
				$set: {
					votes: []
				}
			}
		).exec();

		return res.send({ ok: true });
	}
);

router.get('/votes/reset_my_votes', [requireLogin], async (req, res) => {
	await User.updateMany(
		{
			discordId: req.discordUser.user.id,
			votes: { $exists: true, $type: 'array', $ne: [] }
		},
		{
			$set: {
				votes: []
			}
		}
	).exec();

	await Mission.updateMany(
		{ votes: req.discordUser.user.id },
		{
			$pull: {
				votes: req.discordUser.user.id
			}
		}
	).exec();

	return res.send({ ok: true });
});

module.exports = router;
