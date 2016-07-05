import ReactiveDot from './rdot';
import {reactive} from './rdecorators';

const POSITIVE_INFINITY:number = Number.POSITIVE_INFINITY;

export interface IReactiveListLogRecord {
	type: string;
	index: number;
	value: any;
}

export interface IReactiveListLog {
	list: ReactiveList;
	changes: IReactiveListLogRecord[];
}

class ValueListener {
	public index:number;
	public value:any;
	private handle:Function;

	constructor(index:number, value:any) {
		this.index = index;
		this.value = value;
	}

	onchange(handle:Function) {
		this.handle = handle;

		if (this.value && this.value.changelog) {
			this.value.changelog.onValue(() => handle({
				index: this.index,
				value: this.value
			}));
		}
	}

	destroy() {
		this.value = null;
		this.handle = null;
	}
}

export class ReactiveModel<T> {
	public changed:any = {};
	public changelog:ReactiveDot<any>;

	private _detector:ReactiveDot<any>[];

	constructor(props:T, observable:string[]) {
		for (let key in props) {
			this[key] = props[key];
		}

		this.changelog = new ReactiveDot<any>(this.changed, {
			initialCall: false,
			setter: (value) => {
				this.changed = {};
				return value;
			}
		});

		this._detector = observable.map(name => {
			return new ReactiveDot<any>(() => {
				return this[name];
			}).onValue((val) => {
				this.changed[name] = val;
				this.changelog.set(this.changed);
			}, false);
		});
	}


	destroy() {
		this._detector.forEach(item => item.destroy());
		this.changelog.dispose();
	}
}

export default class ReactiveList {
	@reactive
	public length:number = 0;

	public values:any[] = [];
	public changelog:ReactiveDot<IReactiveListLog>;

	private indexes:ValueListener[] = [];
	private _lastChanges:IReactiveListLogRecord[] = [];

	constructor(...values) {
		this.changelog = new ReactiveDot<any>(null, {
			initialCall: false,
			setter: (value) => {
				this._lastChanges = [];
				return value;
			}
		});

		if (values.length) {
			this.push(...values);
		}
	}

	private _emitChange() {
		this.changelog.set({
			list: this,
			changes: this._lastChanges
		});
	}

	push(...values):number {
		let index:number;

		values.forEach(value => {
			index = this._addAt(value, POSITIVE_INFINITY);
		});

		this._emitChange();

		return index + 1;
	}

	unshift(value):number {
		const index:number = this._addAt(value, 0);
		this._shiftIndexes(index + 1, +1);
		this._emitChange();
		return index;
	}

	private _addAt(value, index:number):number {
		if (index === POSITIVE_INFINITY) {
			index = this.values.length - 1;
		}

		const valueListener = new ValueListener(index, value);

		this.values.splice(index, 0, value);
		this.indexes.splice(index, 0, valueListener);

		valueListener.onchange((data) => {
			this._lastChanges.push({
				type: 'change',
				index: data.index,
				value: data.value
			});

			this._emitChange();
		});

		this.length++;
		this._lastChanges.push({type: 'push', index, value});

		return index + 1;
	}

	private _shiftIndexes(startIndex:number, delta:number) {
		for (let i = startIndex; i < this.length; i++) {
			this.indexes[i].index += delta;
		}
	}

	remove(value) {
		const index:number = this.values.indexOf(value);

		if (index > -1) {
			const valueListener:ValueListener = this.indexes[index];

			this.length--;
			this.values.splice(index, 1);
			this.indexes.splice(index, 1);

			valueListener.destroy();

			this._shiftIndexes(index, -1);

			this._lastChanges.push({type: 'remove', index, value});
			this._emitChange();
		}
	}

	filter(callback):ReactiveList {
		const newList = new ReactiveList();
		let initial:boolean = true;

		this.changelog.onValue(data => {
			data.changes.forEach(item => {
				const type = item.type;
				const value = item.value;

				if (type === 'push') {
					if (callback(value)) {
						newList[item.index ? 'push' : 'add'](value);
					}
				} else if (type === 'remove') {
					newList.remove(value);
				} else if (type === 'change') {
					if (!callback(value)) {
						newList.remove(value);
					}
				}
			});
		}, false);

		return new ReactiveDot<ReactiveList>(() => {
			if (initial) {
				initial = false;

				this.values.forEach(value => {
					if (callback(value)) {
						newList.push(value);
					}
				});
			}

			return newList;
		}).get();
	}
}
