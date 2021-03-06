import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MissionsService } from '@app/services/missions.service';
import { IMission, IUpdate } from '@app/models/mission';
import { UserService } from '@app/services/user.service';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatSelect } from '@angular/material/select';
import { MissionConstants } from '@app/constants/missionConstants';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { SharedService } from '@app/services/shared';

@Component({
	selector: 'app-mission-list',
	templateUrl: './mission-list.component.html',
	styleUrls: ['./mission-list.component.scss']
})
export class MissionListComponent implements OnInit {
	@ViewChild(MatPaginator) paginator: MatPaginator;
	@ViewChild('missionsTable') missionsTable: MatTable<IMission>;
	@ViewChild(MatSort) sort: MatSort;

	rowData: IMission[] = [];

	displayedColumns: string[] = [
		'name',
		'type',
		'size.min',
		'size.max',
		'terrain',
		'era',
		'authorName',
		'lastVersionStr',
		'lastPlayed',
		'uploadDate'
	];
	dataSource: MatTableDataSource<IMission>;
	filterGroup: FormGroup;
	userList: string[];

	doneLoading = false;

	constructor(
		public missionsService: MissionsService,
		public userService: UserService,
		private router: Router,
		public mC: MissionConstants,
		private formBuilder: FormBuilder,
		private sharedService: SharedService
	) {}

	public refresh() {
		this.missionsService.list().subscribe(
			(value) => {
				this.userList = [];

				value.map((mission: IMission) => {
					const lastUpdate =
						mission.updates[mission.updates.length - 1];
					mission.lastVersionStr = this.missionsService.buildVersionStr(
						mission.lastVersion
					);
					if (lastUpdate) {
						this.userService.insertUserIds(lastUpdate.authorID);
					}
				});
				// iterate the list of users, and get the names of those who doesn't have a name yet
				this.userService.getAuthorsName().then((usersOnCache) => {
					value.map((mission) => {
						// find author by id
						const userFound = usersOnCache.find(
							(userOnCahce) =>
								userOnCahce.userID === mission.authorID
						);
						if (userFound) {
							mission.authorName = userFound.displayName;
						}
					});
				});

				this.userList.sort();
				this.dataSource = new MatTableDataSource<IMission>(value);
				this.rowData = this.dataSource.data;
				this.dataSource.paginator = this.paginator;
				this.dataSource.sortingDataAccessor = (item, property) => {
					switch (property) {
						case 'size.min':
							return item.size.min;
						case 'size.max':
							return item.size.max;
						default:
							return item[property];
					}
				};
				this.dataSource.sort = this.sort;
				this.doneLoading = true;
			},
			(error) => {
				console.log('error');
			}
		);
	}

	ngOnInit(): void {
		this.filterGroup = this.formBuilder.group({
			misSearch: new FormControl(''),
			misState: new FormControl(''),
			misAuthor: new FormControl(''),
			misType: new FormControl(''),
			misTerrain: new FormControl(''),
			misTime: new FormControl(''),
			misEra: new FormControl(''),
			misTags: new FormControl('')
		});
		[
			'misState',
			'misAuthor',
			'misType',
			'misTerrain',
			'misTime',
			'misEra'
		].forEach((element) => {
			this.filterGroup.get(element)?.setValue('ALL');
		});
		if (!this.userService.loggedUser) {
			return;
		}
		this.refresh();
	}

	onListChipRemoved(multiSelect: MatSelect, matChipIndex: number): void {
		const misTags = this.filterGroup.get('misTags');
		if (misTags) {
			const selectedChips = [...misTags.value];
			selectedChips.splice(matChipIndex, 1);
			misTags.patchValue(selectedChips);
			multiSelect.writeValue(selectedChips);
			this.applyFilter();
		}
	}

	applyFilterTags() {
		const tagsSelected: string[] = this.filterGroup.get('misTags')?.value;
		console.log('tagsSelected: ', tagsSelected);
		if (tagsSelected.length === 0) {
			this.dataSource.data = this.rowData;
		} else {
			this.dataSource.data = this.rowData.filter((element: IMission) => {
				return tagsSelected.every((tag: string) => {
					return element.tags.includes(tag);
				});
			});
		}
	}

	async applyFilter() {
		let filteredData = this.rowData;
		// State
		const state: string = this.filterGroup.get('misState')?.value;
		console.log('state selected: ', state);
		if (state && state !== 'ALL') {
			console.log('state selected: ', state);
			switch (state) {
				case 'MAIN':
					filteredData = filteredData.filter((element: IMission) => {
						return element.updates.some((u) => {
							return u.main ?? false;
						});
					});
					break;
				case 'TEST':
					filteredData = filteredData.filter((element: IMission) => {
						return element.updates.some((u) => {
							return u.test ?? false;
						});
					});
					break;
				case 'READY':
					filteredData = filteredData.filter((element: IMission) => {
						return element.updates.some((u) => {
							return u.ready ?? false;
						});
					});
					break;
				case 'ARCHIVE':
					filteredData = filteredData.filter((element: IMission) => {
						return element.updates.some((u) => {
							return u.archive ?? false;
						});
					});
					break;
				default:
					break;
			}
		}
		// Author
		const author: string = this.filterGroup.get('misAuthor')?.value;
		if (author && author !== 'ALL') {
			console.log('author selected: ', author);
			filteredData = filteredData.filter((element: IMission) => {
				return element.authorName === author;
			});
		}
		// Type
		const type: string = this.filterGroup.get('misType')?.value;
		if (type && type !== 'ALL') {
			console.log('type selected: ', type);
			filteredData = filteredData.filter((element: IMission) => {
				return element.type === type;
			});
		}
		// Terrain
		const terrain: string = this.filterGroup.get('misTerrain')?.value;
		if (terrain && terrain !== 'ALL') {
			console.log('terrain selected: ', terrain);
			filteredData = filteredData.filter((element: IMission) => {
				return (
					this.missionsService.getTerrainData(element.terrain)
						?.class === terrain
				);
			});
		}
		// Time
		const time: string = this.filterGroup.get('misTime')?.value;
		if (time && time !== 'ALL') {
			console.log('time selected: ', time);
			filteredData = filteredData.filter((element: IMission) => {
				return element.timeOfDay === time;
			});
		}
		// Era
		const era: string = this.filterGroup.get('misEra')?.value;
		if (era && era !== 'ALL') {
			console.log('era selected: ', era);
			filteredData = filteredData.filter((element: IMission) => {
				return element.era === era;
			});
		}
		// Tags
		const tagsSelected: string[] = this.filterGroup.get('misTags')?.value;
		if (tagsSelected && tagsSelected.length !== 0) {
			console.log('tagsSelected: ', tagsSelected);
			filteredData = filteredData.filter((element: IMission) => {
				return tagsSelected.every((tag: string) => {
					return element.tags.includes(tag);
				});
			});
		}
		// Search
		const searchFilter: string = this.filterGroup
			.get('misSearch')
			?.value?.toLowerCase();
		if (searchFilter && searchFilter !== '') {
			console.log('searchFilter: ', searchFilter);

			filteredData = filteredData.filter((element: IMission) => {
				return (
					element.name.toLowerCase().includes(searchFilter) ||
					element.size.min
						.toString()
						.toLowerCase()
						.includes(searchFilter) ||
					element.size.max
						.toString()
						.toLowerCase()
						.includes(searchFilter) ||
					element.era.toLowerCase().includes(searchFilter) ||
					element.authorName?.toLowerCase().includes(searchFilter) ||
					element.updates.some((update: IUpdate) => {
						return update.authorName === searchFilter;
					}) ||
					this.missionsService
						.buildVersionStr(element.lastVersion)
						.includes(searchFilter) ||
					this.missionsService
						.getTerrainData(element.terrain)
						?.display_name.toLowerCase()
						.includes(searchFilter) ||
					element.type.toLowerCase().includes(searchFilter) ||
					element.timeOfDay.toLowerCase().includes(searchFilter) ||
					element.description.toLowerCase().includes(searchFilter)
				);
			});
		}
		// Assign changes
		this.dataSource.data = filteredData;
		if (this.dataSource.paginator) {
			this.dataSource.paginator.firstPage();
		}
	}

	onActivate(row: IMission, newtab: boolean) {
		console.log('got click event for:', row.name);
		if (newtab) {
			window.open(`/mission-details/${row.uniqueName}`);
		} else {
			this.router.navigate([`/mission-details/${row.uniqueName}`]);
		}
	}

	disableScroll(e) {
		if (e.button === 1) {
			e.preventDefault();
		}
	}
}
