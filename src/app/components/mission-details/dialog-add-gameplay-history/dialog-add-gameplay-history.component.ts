import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MissionsService } from '@app/services/missions.service';

import { IHistory, IMission, IUpdate } from '@app/models/mission';
import { DialogActionsComponent } from '@app/components/mission-details/dialog-actions/dialog-actions.component';
import { UserService } from '@app/services/user.service';
import { Observable } from 'rxjs';
import { FormControl } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';

import { ILeader } from '@app/models/leader';
import { DatePipe } from '@angular/common';
import { RemoteDiscordUser } from '@app/models/remoteDiscordUser';

@Component({
	selector: 'app-dialog-add-gameplay-history',
	templateUrl: './dialog-add-gameplay-history.component.html',
	styleUrls: ['./dialog-add-gameplay-history.component.scss']
})
export class DialogAddGameplayHistoryComponent implements OnInit {
	constructor(
		public dialogRef: MatDialogRef<DialogActionsComponent>,
		public missionsService: MissionsService,
		public userService: UserService,
		private datePipe: DatePipe,
		@Inject(MAT_DIALOG_DATA)
		public data: {
			discordUser: RemoteDiscordUser;
			mission: IMission;
			update: IUpdate;
			oldHistory: IHistory;
		}
	) {}

	userListControl = new FormControl();
	outcomeControl = new FormControl();

	filtredDiscordUsers: Observable<RemoteDiscordUser[]>;
	filtredOutcomes: Observable<string[]>;

	public noteMarkdown = '';
	public showNotePreview = false;

	public discordUsers: RemoteDiscordUser[] = [];
	public selectedLeaders: Set<ILeader> = new Set();
	outcomes: string[] = [
		'Major victory',
		'Victory',
		'Pyrrhic victory',

		'Major defeat',
		'Defeat',
		'Valiant defeat',

		'Major BLUFOR victory',
		'BLUFOR victory',
		'Minor BLUFOR victory',

		'Major OPFOR victory',
		'OPFOR victory',
		'Minor OPFOR victory',

		'Major INDFOR victory',
		'INDFOR victory',
		'Minor INDFOR victory',

		'Major CIV victory',
		'CIV victory',
		'Minor CIV victory'
	];
	public history: IHistory = {};
	public historyDateString: string | null = '';

	getOptionText(option) {
		return option?.displayName ?? '';
	}

	private _filterOutcome(value: string): string[] {
		const filterValue = value.toLowerCase();

		return this.outcomes.filter((option) =>
			option.toLowerCase().includes(filterValue)
		);
	}

	private _filterDiscordUser(
		value: string | RemoteDiscordUser
	): RemoteDiscordUser[] {
		if (typeof value !== 'string') {
			return [value];
		}
		const filterValue = value.toLowerCase();
		return this.discordUsers.filter(
			(option) =>
				option.displayName?.toLowerCase().indexOf(filterValue) === 0
		);
	}

	ngOnInit(): void {
		this.historyDateString = this.datePipe.transform(
			Date.now(),
			'MM/dd/yyyy'
		);

		this.filtredDiscordUsers = this.userListControl.valueChanges.pipe(
			startWith(''),
			map((value) => this._filterDiscordUser(value))
		);

		this.filtredOutcomes = this.outcomeControl.valueChanges.pipe(
			startWith(''),
			map((value) => this._filterOutcome(value))
		);

		this.userService.listDiscordUsers().subscribe((value) => {
			this.discordUsers = value;
		});

		if (this.data.oldHistory) {
			this.history = this.data.oldHistory;
			this.outcomeControl.setValue(this.history.outcome);
			this.selectedLeaders = new Set(this.history.leaders);
			this.historyDateString = this.datePipe.transform(
				this.history.date,
				'MM/dd/yyyy'
			);
		}
	}

	onLeaderSelected(option: any) {
		this.userListControl.setValue('');
		this.selectedLeaders.add({
			displayName: option.value.displayName,
			discordID: option.value.userID,
			role: 'leader'
		});
	}

	removeLeader(leader: ILeader) {
		this.selectedLeaders.delete(leader);
	}

	onSideSelected(option, leader: ILeader) {
		leader.side = option.value;
	}

	onRoleSelected(option, leader: ILeader) {
		leader.role = option.value;
	}

	submitGameplayHistory() {
		if (this.historyDateString) {
			this.history.date = new Date(this.historyDateString);
		}
		this.history.leaders = Array.from(this.selectedLeaders);
		this.history.outcome = this.outcomeControl.value;

		this.dialogRef.close(this.history);
	}
}
