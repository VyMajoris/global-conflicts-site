export interface IUpdate {
	version: {
		major: number;
		minor?: string;
	};
	_id?: string;
	authorID: string;
	authorName?: string;
	date: Date;
	changeLog: string;
	addressesReports?: string;
	fileName: string;
	path?: string;
	archive?: boolean;
	main?: boolean;
	ready?: boolean;
	test?: boolean;
	versionStr?: string;
}

export interface IRatios {
	blufor?: number;
	opfor?: number;
	indfor?: number;
	civ?: number;
}

export interface IReport {
	_id?: string;
	version: {
		major: number;
		minor?: string;
	};
	authorID: string;
	authorName?: string;
	date: Date;
	report: string;
	log?: string;
	versionStr?: string;
}

export interface IReview {
	_id?: string;
	version: {
		major: number;
		minor?: string;
	};
	authorID: string;
	authorName?: string;
	date: Date;
	review: string;
	versionStr?: string;
}

export interface IEdit {
	size?: {
		min: number;
		max: number;
	};
	type?: string;
	ratios?: IRatios;
	description?: string;
	jip?: boolean;
	respawn?: boolean;
	tags?: string[];
	timeOfDay?: string;
	era?: string;
	image?: string;
}

export interface IMission {
	uniqueName: string;
	name: string;
	authorName?: string;
	authorID: string;
	terrain: string;
	type: string;
	size: {
		min: number;
		max: number;
	};
	ratios?: IRatios;
	description: string;
	jip: boolean;
	respawn: boolean;
	tags: string[];
	timeOfDay: string;
	era: string;
	image?: string;
	uploadDate: Date;
	lastUpdate: Date;
	updates: IUpdate[];
	lastVersion: {
		major: number;
		minor?: string;
	};
	lastVersionStr?: string;
	reports?: IReport[];
	reviews?: IReview[];
	gameplayHistory?: IHistory[];
}

export interface IHistory {
	date: Date;
	bluforLeader: string;
	redforLeader: string;
	indforLeader: string;
	civLeader: string;
	bluforAAR: string;
	redforAAR: string;
	indforAAR: string;
	civAAR: string;
	outcome: string;
}
