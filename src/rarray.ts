import ReactiveDot, {rexpression} from './rdot';

interface RAChanges {
	index:number;
	added:any[];
	deleted:any[];
}

export default class ReactiveArray {
	static from(array:any[]):ReactiveArray {
		return new ReactiveArray(...array);
	}

	private _ritems:ReactiveDot<any[]> = new ReactiveDot<any[]>([]);
	private _rlength:ReactiveDot<number> = new ReactiveDot<number>(0);
	private _changes:RAChanges[] = [];

	public changes:ReactiveDot<RAChanges[]> = new ReactiveDot<RAChanges[]>([], {
		initialCall: false,
		setter: (value) => {
			this._changes = [];
			return value;
		}
	});

	get length():number {
		return this._rlength.get();
	}

	set length(value:number) {
		// todo: resize array
		this._rlength.set(value);
	}

	constructor(...values) {
		values.length && this.push(...values);
	}

	push(...values):number {
		const startIndex:number = this._rlength.staticValue;
		let newLength:number = startIndex;

		values.forEach((value) => {
			this._addValue(value, newLength++);
		});

		this.emitChanges(startIndex, values);

		return newLength;
	}

	unshift(...values) {
		let newLength:number = this._rlength.staticValue;

		values.forEach((value) => {
			this._addValue(value, 0);
		});

		return newLength;
	}

	forEach(callback:(value:any, index?:number) => void) {
		this._ritems.get().forEach(callback);
	}

	filter(iterator:(value:any, index?:number) => boolean):ReactiveArray {
		const filtered = new ReactiveArray();

		this._ritems.onValue((items) => {
			filtered.setArray(items.filter(iterator));
		});

		return filtered;
	}

	reduce(callback:(previousValue:any, currentValue:any) => any, initialValue?:any):any {
		return this._ritems.get().reduce(callback, initialValue);
	}

	indexOf(value:any):number {
		return this._ritems.get().indexOf(value);
	}

	splice(start:number, deleteCount:number, ...insert):any[] {
		const array = this._ritems.get();
		const deleted = array.splice(start, deleteCount, ...insert);

		if (deleted.length) {
			this.setArray(array.slice(0));
		}

		return deleted;
	}

	setArray(items:any[]) {
		items.forEach((_, index) => this._initGetter(index));

		this._ritems.set(items);
		this._rlength.set(items.length);
	}

	toArray():any[] {
		return this._ritems.get();
	}

	get() {
		return this._ritems.get();
	}

	private emitChanges(index:number, added:any[] = null, removed:any[] = null) {
		//this._changes.push(<RAChanges>{
		//	index,
		//	added,
		//	removed
		//});
		//
		//this.changes.set(this._changes);
	}

	private _initGetter(index:number) {
		if (0 && this[index] === void 0) {
			Object.defineProperty(this, index + '', {
				get: () => this._ritems.get()[index],
				set: (value:any) => this._updateValue(index, value),
				enumerable: true
			});
		}

	}

	private _addValue(value:any, index:number) {
		const newLength:number = this._rlength.get() + 1;
		const newItems = this._ritems.staticValue.slice(0);

		newItems.splice(index, 0, value);

		this._initGetter(index);
		this._ritems.set(newItems);
		this._rlength.set(newLength);

		return newLength;
	}

	private _updateValue(index:number, value:any) {
		throw 'todo';
	}
}
