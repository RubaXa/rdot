/**
 * Reactive Dot
 */

type ReactiveCallback<T> = (dot?:ReactiveDot<T>) => void;
type ReactiveGetter<T> = (dot?:ReactiveDot<T>) => T;
type ReactiveSetter<T> = (currentValue?:T, previousValue?:T) => T;
type ReactiveOnValueListener<T> = (currentValue?:T, previousValue?:T) => void;
type ReactiveCombinator<T> = (dots:Array<T>) => ReactiveDot<T>;

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

const setImmediate = window.setImmediate || window.setTimeout;
const defaultOptions:ReactiveOptions<any> = {};

function _add2Queue(dot:ReactiveDot<any>, compute?:boolean) {
	if (_queueExists[dot.id] === void 0) {
		dot.revision = null;
		_queue.push(dot);
		_queueExists[dot.id] = 1; // wtf? невозможно строго указать, что индекс может быть только цифровым, например `_queueMap['for'] = 1;` не выдас ошибок
	}

	if (compute && (_computing === void 0 && _computing !== -1)) {
		if (dot.onValueListeners !== void 0 || dot.options.sync === true) {
			_computing = _computing || 1;
			_computingAll();
		}
		else {
			_computing = setImmediate(_computingAll);
		}
	}
}

function _computingAll() {
	if (_computing !== void 0 && _computing !== -1) {
		_computing = -1;
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
		_computing = void 0;
	}
}


class ReactiveDot<T> {
	/** Local identifier. readonly. */
	public id:number;

	/** Type of value. readonly. */
	public constant:boolean;

	/** Last calculated reactive value. readonly. */
	public value:T;

	public options:ReactiveOptions<T>;
	private staticValue:T;
	private getter:Function;

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
		if (_computing !== void 0 && _computing !== -1) {
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
		this.linked = [];
		this.linkedExists = {};
		this.dependsOn = [];
		this.dependsOnExists = {};
		this.onValueListeners = [];
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

	map<R extends T>(fn:Function):ReactiveDot<R> {
		return new ReactiveDot<R>(() => fn(this.get(), this));
	}

	filter<R extends T>(fn:Function):ReactiveDot<R> {
		let retVal;

		return new ReactiveDot<R>(() => {
			const val = this.get();

			if (fn(val)) {
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

	static fromEvent<T extends Event>(el:Element, eventName:string):ReactiveDot<T> {
		let dot = new ReactiveDot<T>(new Event(eventName) as T, {
			setup() {
				this.handle = (evt) => this.set(evt);
				el.addEventListener(eventName, this.handle);
			},

			teardown() {
				el.removeEventListener(eventName, this.handle);
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

class ReactiveDom extends ReactiveDot<string> {
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

function reactiveDecorator(depends:any[], initFn?:Function);
function reactiveDecorator(target:any, propertyName:string, descriptor?:TypedPropertyDescriptor<any>);
function reactiveDecorator(target, propertyName?, descriptor?) {
	if (target instanceof Array) {
		const depends = target;
		const length = depends.length;
		const initFn = propertyName;

		return function (target:any, propertyName:string, descriptor:TypedPropertyDescriptor<any>) {
			const privateName = `__rdot:${propertyName}`;
			const propertyValue = target[propertyName];
			const isFunction = typeof propertyValue === 'function';

			descriptor.get = function () {
				let dot = this[privateName];

				if (dot === void 0) {
					dot = new rdot(() => {
						const values = new Array(length);

						if (length <= 3) {
							values[0] = this[depends[0]];
							(length === 2) && (values[1] = this[depends[1]]);
							(length === 3) && (values[2] = this[depends[2]]);
						} else {
							for (let i = 0; i < length; i++) {
								values[i] = this[depends[i]];
							}
						}

						return values;
					});

					dot = initFn ? initFn(dot) : dot;

					if (isFunction) {
						dot.onValue(val => propertyValue.call(this, val));
					}
				}

				if (isFunction) {
					return propertyValue;
				} else {
					return dot.get();
				}
			};

			descriptor.set = function () {
				console.warn(`${propertyName} — readonly`);
			};
		};
	} else {
		const privateName = `__rdot:${propertyName}`;

		descriptor.get = function () {
			let dot = this[privateName];
			return dot !== void 0 && dot.get();
		};

		descriptor.set = function (value) {
			let dot = this[privateName];

			if (dot === void 0) {
				this[privateName] = new rdot(value);
			} else {
				dot.set(value);
			}
		};
	}
}


// Export
export default ReactiveDot;
export const rdot = ReactiveDot;
export const reactive = reactiveDecorator;
