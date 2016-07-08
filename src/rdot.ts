/**
 * Reactive Dot
 */

export type ReactiveCallback<T> = (dot?:ReactiveDot<T>) => void;
export type ReactiveGetter<T> = (dot?:ReactiveDot<T>) => T;
export type ReactiveSetter<T> = (currentValue?:T, previousValue?:T) => T;
export type ReactiveOnValueListener<T> = (currentValue?:T, previousValue?:T) => void;
export type ReactiveCombinator<T> = (dots:Array<T>) => ReactiveDot<T>;
export type DOMElement = HTMLElement|Window|Document;

export interface ReactiveOptions<T> {
	initialCall?: boolean;
	sync?: boolean;
	setter?: ReactiveSetter<T>;
	setup?: ReactiveCallback<T>;
	teardown?: ReactiveCallback<T>;
}

interface ReactiveDotExists {
	[index: number]: number;
}

/** Global incremetal id */
let gid:number = 0;
let _activeDot:ReactiveDot<any> = void 0;
let _queue:ReactiveDot<any>[] = [];
let _queueExists:ReactiveDotExists = {};

let _revision:number = 0;
let _computing:number = void 0;

const STATE_AWAITING = void 0;
const STATE_BUSY = -1;
const STATE_READY = 1;

const setImmediate = window.setImmediate || window.setTimeout;
const defaultOptions:ReactiveOptions<any> = {};

function _add2Queue(dot:ReactiveDot<any>, compute?:boolean) {
	if (_queueExists[dot.id] === void 0) {
		dot.revision = null;
		_queue.push(dot);
		_queueExists[dot.id] = 1; // wtf? невозможно строго указать, что индекс может быть только цифровым, например `_queueMap['for'] = 1;` не выдас ошибок
	}

	if (compute && (_computing === STATE_AWAITING && _computing !== STATE_BUSY)) {
		if (dot.options.sync === true) {
			_computing = _computing || STATE_READY;
			_computingAll();
		}
		else {
			_computing = STATE_READY;
			// _computingAll();
			_computing = setImmediate(_computingAll);
		}
	}
}

function _computingAll() {
	if (_computing !== STATE_AWAITING && _computing !== STATE_BUSY) {
		_computing = STATE_BUSY;
		_revision++;

		let cursor = 0;

		do {
			let dot = _queue[cursor];
			let linked = dot.linked;

			// computing
			dot.get();

			if (linked) {
				const length = linked.length;

				if (length > 0) {
					if (length <= 2) {
						_add2Queue(linked[0]);
						(length === 2) && _add2Queue(linked[1]);
					} else {
						for (let i = 0; i < length; i++) {
							_add2Queue(linked[i]);
						}
					}
				}
			}

			cursor++;
		} while (cursor < _queue.length);

		_queue = [];
		_queueExists = {};
		_computing = STATE_AWAITING;
	}
}


export class ReactiveState {
	static INITIALIZATION = new ReactiveState('initialization');
	static INTERACTIVE = new ReactiveState('interactive');
	static PROCESSING = new ReactiveState('processing');
	static READY = new ReactiveState('READY');
	static ERROR = new ReactiveState('ERROR');

	constructor(public name:string, public detail?:any) {
	}
}


export default class ReactiveDot<T> {
	/** Local identifier. readonly. */
	public id:number;

	/** Type of value. readonly. */
	public constant:boolean;

	/** Last calculated reactive value. readonly. */
	public value:T;

	public options:ReactiveOptions<T>;
	public staticValue:T;
	public getter:Function;

	public linked:ReactiveDot<any>[];
	public linkedExists:Object; // todo: MapInterface

	private dependsOn:ReactiveDot<any>[];
	private dependsOnExists:Object; // todo: MapInterface

	public tick = 0;
	public revision:number;
	public onValueListeners:ReactiveOnValueListener<T>[];
	public interactive:boolean;

	constructor(value?:T, setter?:ReactiveSetter<T>);
	constructor(value?:T, options?:ReactiveOptions<T>);
	constructor(getter?:ReactiveGetter<T>, setter?:ReactiveSetter<T>);
	constructor(getter?:ReactiveGetter<T>, options?:ReactiveOptions<T>);
	constructor(value?, opts?) {
		let options:ReactiveOptions<T> = opts;

		if (opts === void 0) {
			options = defaultOptions;
		}

		if (typeof opts === 'function') {
			options = {setter: opts};
		}

		this.id = ++gid;
		this.options = options;
		this.constant = typeof value !== 'function';

		if (this.constant) {
			this.staticValue = value;
		} else {
			this.getter = value;
		}

		this.linked = [];
		this.linkedExists = {};

		this.dependsOn = [];
		this.dependsOnExists = {};
	}

	/** Get current reactive value */
	get():T {
		if (_computing !== STATE_AWAITING && _computing !== STATE_BUSY) {
			_computingAll();
		}

		let currentValue:T = this.value;
		let previousValue:T = currentValue;
		let previousActiveDot:ReactiveDot<any> = _activeDot;
		let changed:boolean;

		if (_activeDot !== void 0) {
			if (this.linkedExists[_activeDot.id] === void 0) {
				this.linkedExists[_activeDot.id] = 1;
				this.linked.push(_activeDot);

				_activeDot.dependsOn.push(this);
			}

			_activeDot.dependsOnExists[this.id] = _activeDot.tick;
			//console.log('setTick.dot: %d, prev: %d, active: %d', dot.id, dependsOnTick, _activeDot.tick);
		}

		// Значение устарело, требуется перерасчет
		if (this.revision !== _revision) {
			const options = this.options;
			const _setter = options.setter;
			//console.log('dot: %d, tick: %d, rev: %d (new: %d)', dot.id, dot.tick, dot.revision, _revision);

			if (!this.interactive) {
				// Переводим в интерактивное состояние
				this.interactive = true;
				options.setup && options.setup.call(this);

				if (this.revision === _revision) {
					// Похоже в setup, уже вычеслили значение
					return this.value;
				}
			}

			this.tick++;
			this.revision = _revision;

			// Computing value
			//console.log('getter.dot: %d, rev: %d, tick: %d', dot.id, _revision, dot.tick);
			//noinspection JSUnusedAssignment
			_activeDot = this;

			currentValue = this.constant ? this.staticValue : this.getter(this);

			_activeDot = previousActiveDot;

			if (_setter !== void 0) {
				currentValue = _setter(currentValue, previousValue);
			}

			changed = previousValue !== currentValue;

			this.value = currentValue;

			if (changed) {
				_notify(this, currentValue, previousValue);

			}

			// Проверяем точки, от которых мы зависим
			let dependsOn = this.dependsOn;

			if (dependsOn !== null) {
				let dependsOnExists = this.dependsOnExists;
				let idx = dependsOn.length;

				if (idx !== 0) {
					let depDot;
					let tick = this.tick;
					//console.log('dependsOn.check: %d, tick: %d', dot.id, dot.tick);

					while (idx--) {
						depDot = dependsOn[idx];
						//console.log('dependsOn.id: %d, cur.tick: %d, eq.tick: %d', depDot.id, _dependsOn[depDot.id], tick);

						if (dependsOnExists[depDot.id] !== tick) {
							_unlink(depDot, this);
						}
					}
				}
			}
		}

		return currentValue;
	}

	/** Set new reactive value or getter */
	set(value:T):ReactiveDot<T>;
	set(getter:ReactiveGetter<T>):ReactiveDot<T>;
	set(getter) {
		this.constant = typeof getter !== 'function';

		if (this.constant) {
			this.staticValue = getter;
		} else {
			this.getter = getter;
		}

		_add2Queue(this, true);

		return this;
	}

	/** Subscribe to changes on reactive value */
	onValue(callback:ReactiveOnValueListener<any>, initialCall?:boolean) {
		if (initialCall !== false && this.options.initialCall !== false) {
			callback(this.get());
		} else {
			this.get(); // Init
		}

		if (this.onValueListeners === void 0) {
			this.onValueListeners = [callback];
		} else {
			this.onValueListeners.push(callback);
		}

		return this;
	}

	dispose():void {
		this.value = null;
		this.constant = true;
		this.staticValue = null;
		this.getter = null;

		this.linked = [];
		this.linkedExists = {};
		this.dependsOn = [];
		this.dependsOnExists = {};
		this.onValueListeners = [];
	}

	destroy() {
		this.value = null;
		this.constant = true;
		this.staticValue = null;
		this.getter = null;

		this.linked = null;
		this.linkedExists = null;
		this.dependsOn = null;
		this.dependsOnExists = null;
		this.onValueListeners = null;
	}

	valueOf():T {
		return this.get();
	}

	toString():string {
		return this.get() + '';
	}

	forceCompute() {
		this.value = void 0; // clear value
		_add2Queue(this, true);
	}

	map<R>(callback:(value:T) => R):ReactiveDot<R> {
		return new ReactiveDot<R>(() => callback(this.get()));
	}

	filter<R>(callback:(value:T) => R):ReactiveDot<R> {
		let retVal;

		return new ReactiveDot<R>(() => {
			const val = this.get();

			if (callback(val)) {
				retVal = val;
			}

			return retVal;
		}, {
			initialCall: false
		});
	}

	throttle(msec:number):ReactiveDot<T> {
		let pid;
		let lock = false;
		let retVal;
		const apply = () => {
			pid = null;
			lock = true;
			dot.forceCompute();
			dot.get();
			lock = false;
		};

		const dot = new ReactiveDot<T>(() => {
			if (!pid) {
				retVal = this.get();
				!lock && (pid = setTimeout(apply, msec));
			}

			return retVal;
		});

		return dot;
	}

	not():ReactiveDot<boolean> {
		return new ReactiveDot<boolean>(() => !this.get());
	}

	assign(target:HTMLElement, prop:string):this {
		if (!prop && target.nodeType === 1) {
			prop = 'textContent';
		}

		this.onValue(val => {
			target[prop] = val;
		});

		return this;
	}

	next<R>(callback:(value:T) => R):ReactiveDot<R> {
		return new ReactiveDot<R>(() => callback(this.get()));
	}

	arrayFilter(fn:Function):ReactiveDot<any[]> {
		const dot = new ReactiveDot<any[]>(() => {
			const data = fn(this.get());
			const prev = dot['__arrayFilter'] || [];
			const filtered = [];
			const array:any[] = data.array;
			const callback:Function = data.callback;

			let changed = false;

			for (let i = 0, n = array.length; i < n; i++) {
				if (callback(array[i], i, array)) {
					filtered.push(array[i]);
					changed = changed || array[i] !== prev[i];
				} else {
					changed = true;
				}
			}

			dot['__arrayFilter'] = (changed ? filtered : dot['__arrayFilter'] || array.slice(0));

			return changed && (array.length !== filtered.length) ? filtered : array;
		});

		return dot;
	}

	/** Create a reactive dot and bind it with HTMLElement */
	static dom(el:HTMLInputElement):ReactiveDom {
		return new ReactiveDom(el);
	}

	static fromEvent<T extends Event>(el:DOMElement, eventName:string):ReactiveDot<T> {
		let dot = new ReactiveDot<T>(new Event(eventName) as T, {
			setup() {
				this.handle = (evt) => this.set(evt);
				(el as HTMLElement).addEventListener(eventName, this.handle);
			},

			teardown() {
				(el as HTMLElement).removeEventListener(eventName, this.handle);
				this.handle = null;
			}
		});

		dot.get(); // setup

		return dot as ReactiveDot<T>;
	}

	/** Combines two or more dots together */
	static combine<T, R>(dots:Array<T>, combinator?:ReactiveCombinator<T>):ReactiveDot<R> {
		const length:number = dots.length;

		return new ReactiveDot<R>(() => {
			let dot;
			let idx:number = length;
			let results:Array<any> = new Array(length);

			while (idx--) {
				dot = dots[idx];
				results[idx] = dot ? (dot.get ? dot.get() : (dot.onValue ? dot() : dot)) : dot;
			}

			return combinator ? combinator.apply(null, results) : results;
		});
	}
}

export class ReactiveDom extends ReactiveDot<string> {
	public el:HTMLInputElement;

	constructor(el:HTMLInputElement) {
		super(el.value, {
			setup: () => {
				el.addEventListener('input', this, false);
			},

			teardown: () => {
				this.set(el.value);
				el.removeEventListener('input', this, false);
			},

			setter: (newValue:string):string => {
				if (el.value !== newValue) {
					el.value = newValue;
				}

				return newValue;
			}
		});

		this.el = el;
		this.get();
	}

	handleEvent() {
		this.set(this.el.value);
	}
}


/** Unlink `dot`. private. */
function _unlink(target:ReactiveDot<any>, dot:ReactiveDot<any>) {
	const linked = target.linked;
	const idx = linked.indexOf(dot);

	if (idx > -1) { // todo: в mvc тесте при allChecked возвпроизводиться стабильно
		//console.warn('unlink.dot: %d (idx: %d), from.dot: %d', dot.id, idx, target.id);

		linked.splice(idx, 1);
		delete target.linkedExists[dot.id];

		if (linked.length === 0) {
			if (dot.interactive === true) {
				dot.interactive = false;

				if (dot.options.teardown !== void 0) {
					dot.options.teardown.call(dot);
				}
			}
		}
	}
}

/** Notify linked dots about the changes */
function _notify(dot:ReactiveDot<any>, currentValue:any, previousValue:any) {
	const listeners = dot.onValueListeners;

	if (listeners !== void 0) {
		if (arguments.length > 1) {
			if (listeners.length === 1) {
				listeners[0](currentValue, previousValue);
			} else {
				listeners.forEach(fn => fn(currentValue, previousValue)); // slowest
			}
		}
	}
}


// Export
export const rdot = ReactiveDot;

export function rexpression<T>(expr:ReactiveGetter<T>):T {
	return <T><any>new ReactiveDot<T>(expr);
}

export class RStream<T> extends ReactiveDot<T> {
	constructor(value?:T) {
		super(value, {initialCall: false, sync: true} as ReactiveOptions<T>);
	}

	add(value:T) {
		this.value = null;
		this.set(value);

		return this;
	}
}

export function rfunction<T>(callback:Function):(...args) => T {
	let _this:any;
	let _args:any[];
	const dot = new ReactiveDot<T>(() => { return callback.apply(_this, _args); });

	return function rfn(...args) {
		_args = args;
		_this = this;
		return dot.get();
	};
}
