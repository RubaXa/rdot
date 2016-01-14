/**
 * Reactive Dot
 */

type ReactiveCallback<T> = (dot?:ReactiveDot<T>) => void;
type ReactiveGetter<T> = (dot?:ReactiveDot<T>) => T;
type ReactiveSetter<T> = (currentValue?:T, previousValue?:T) => T;
type ReactiveOnValueListener<T> = (currentValue?:T, previousValue?:T) => void;

export interface IReactiveDotFactory {
	<T>(value?:T, setter?:ReactiveSetter<T>): ReactiveDot<T>;
	<T>(value?:T, options?:ReactiveOptions<T>): ReactiveDot<T>;
	<T>(getter?:ReactiveGetter<T>, setter?:ReactiveSetter<T>): ReactiveDot<T>;
	<T>(getter?:ReactiveGetter<T>, options?:ReactiveOptions<T>): ReactiveDot<T>;

	extend?(methods:any):void;

	/** Create a reactive dot and bind it with HTMLElement */
	dom?(element:HTMLInputElement):ReactiveDom;
}

/** Reactive value containter */
export interface ReactiveDot<T> {AKS
	/** readonly */
	id: number;

	/** readonly */
	constant: boolean;

	/** Last calculated reactive value. readonly. */
	value: T;

	/** Get current reactive value */
	(): T;

	/** Get current reactive value */
	get(): T;

	/** Set new reactive value or getter */
	set(value:T): ReactiveDot<T>;
	set(getter:ReactiveGetter<T>): ReactiveDot<T>;

	/** Subscribe to changes on reactive value */
	onValue(callback:ReactiveOnValueListener<T>): ReactiveDot<T>;

	valueOf(): T;
	toString(): string;
}

/** Reactive DOM Element */
export interface ReactiveDom extends ReactiveDot<string> {
	el?: HTMLElement;
	handle?(evt?:Event): void;
}

/** Private */
export interface ReactiveDotPrivate<T> extends ReactiveDot<T> {
	tick: number;
	interactive: boolean;
	revision?: number;
	options: ReactiveOptions<T>;
	onValueListeners?: ReactiveOnValueListener<T>[];

	getter: ReactiveGetter<T>;
	staticValue: T;

	linked: ReactiveDotPrivate<T>[];
	linkedExists: ReactiveDotExists;

	dependsOn: ReactiveDotPrivate<T>[];
	dependsOnExists: ReactiveDotExists;
}

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
let _activeDot:ReactiveDotPrivate<any> = void 0;
let _queue:ReactiveDotPrivate<any>[] = [];
let _queueExists:ReactiveDotExists = {};

let _revision:number = 0;
let _computing:number = void 0;

const defaultOptions:ReactiveOptions<any> = {};

function _add2Queue(dot:ReactiveDotPrivate<any>) {
	if (_queueExists[dot.id] === void 0) {
		_queue.push(dot);
		_queueExists[dot.id] = 1; // wtf? невозможно строго указать, что индекс может быть только цифровым, например `_queueMap['for'] = 1;` не выдас ошибок
	}
}

function _computingAll() {
	if (_computing !== void 0) {
		_computing = void 0;
		_revision++;

		let cursor = 0;

		do {
			let dot = _queue[cursor];
			let linked = dot.linked;

			// computing
			dot();

			if (linked) {
				for (let i = 0; i < linked.length; i++) {
					_add2Queue(linked[i]);
				}
			}

			cursor++;
		} while (cursor < _queue.length);

		_queue = [];
		_queueExists = {};
	}
}


// Constructor
const rdot:IReactiveDotFactory = <T>(value?, opts?):ReactiveDot<T> => {
	let options:ReactiveOptions<T> = opts;

	if (opts === void 0) {
		options = defaultOptions;
	}

	if (typeof opts === 'function') {
		options = {setter: opts};
	}

	let _setter:ReactiveSetter<T> = options.setter;

	let dot:ReactiveDotPrivate<T> = <ReactiveDotPrivate<T>>function reactiveDot() {
		if (_computing !== void 0) {
			_computingAll();
		}

		let currentValue:T = dot.value;
		let previousValue:T = currentValue;
		let previousActiveDot:ReactiveDotPrivate<T> = _activeDot;
		let changed:boolean;

		if (_activeDot !== void 0) {
			if (dot.linkedExists[_activeDot.id] === void 0) {
				dot.linkedExists[_activeDot.id] = 1;
				dot.linked.push(_activeDot);

				_activeDot.dependsOn.push(dot);
			}

			_activeDot.dependsOnExists[dot.id] = _activeDot.tick;
			//console.log('setTick.dot: %d, prev: %d, active: %d', dot.id, dependsOnTick, _activeDot.tick);
		}

		// Значение устарело, требуется перерасчет
		if (dot.revision !== _revision) {
			//console.log('dot: %d, tick: %d, rev: %d (new: %d)', dot.id, dot.tick, dot.revision, _revision);
			dot.revision = _revision;

			dot.tick++;

			if (dot.interactive === false) {
				// Переводим в интерактивное состояние
				dot.interactive = true;
				options.setup && options.setup.call(dot);

				if (dot.revision === _revision) {
					// Похоже в setup, уже вычеслили значение
					return dot.value;
				}
			}

			// Computing value
			//console.log('getter.dot: %d, rev: %d, tick: %d', dot.id, _revision, dot.tick);
			//noinspection JSUnusedAssignment
			_activeDot = dot;

			currentValue = dot.constant ? dot.staticValue : dot.getter(dot);

			_activeDot = previousActiveDot;

			if (_setter !== void 0) {
				currentValue = _setter(currentValue, previousValue);
			}

			changed = previousValue !== currentValue;

			dot.value = currentValue;

			if (changed) {
				_notify(dot, currentValue, previousValue);
			}

			// Проверяем точки, от которых мы зависим
			let dependsOn = dot.dependsOn;
			let dependsOnExists = dot.dependsOnExists;
			let idx = dependsOn.length;

			if (idx !== 0) {
				let depDot;
				let tick = dot.tick;
				//console.log('dependsOn.check: %d, tick: %d', dot.id, dot.tick);

				while (idx--) {
					depDot = dependsOn[idx];
					//console.log('dependsOn.id: %d, cur.tick: %d, eq.tick: %d', depDot.id, _dependsOn[depDot.id], tick);

					if (dependsOnExists[depDot.id] !== tick) {
						//console.warn('unlink.dot: %d, from.dot: %d', dot.id, depDot.id);
						_unlink(depDot, dot);
					}
				}
			}
		}


		return currentValue;
	};

	// Extending hack
	for (let key in rdot['fn']) {
		dot[key] = rdot['fn'][key];
	}

	// Readonly private props
	dot.id = ++gid;
	dot.options = options;

	dot.constant = typeof value !== 'function';

	if (dot.constant) {
		dot.staticValue = value;
	} else {
		dot.getter = value;
	}

	dot.linked = [];
	dot.linkedExists = {};

	dot.dependsOn = [];
	dot.dependsOnExists = {};

	return <ReactiveDot<T>>dot;
};

// METHODS
rdot['fn'] = {};
rdot.extend = function (methods:any) {
	for (let key in methods) {
		rdot['fn'][key] = methods[key];
	}
};

rdot.extend({
	tick: 0,

	get() {
		return this();
	},

	set(value) {
		const dot:ReactiveDotPrivate<any> = this;

		dot.constant = typeof value !== 'function';

		if (dot.constant) {
			dot.staticValue = value;
		} else {
			dot.getter = value;
		}

		_add2Queue(dot);

		if (dot.onValueListeners !== void 0 || dot.options.sync === true) {
			_computing = _computing || 1;
			_computingAll();
		}
		else if (_computing === void 0) {
			_computing = setTimeout(_computingAll, 0);
		}

		return dot;
	},

	onValue(callback:ReactiveOnValueListener<any>, initialCall:boolean) {
		const dot:ReactiveDotPrivate<any> = this;

		if (initialCall !== false && dot.options.initialCall !== false) {
			callback(dot());
		} else {
			dot(); // Init
		}

		if (dot.onValueListeners === void 0) {
			dot.onValueListeners = [callback];
		} else {
			dot.onValueListeners.push(callback);
		}

		return dot;
	},

	valueOf() {
		return <ReactiveDotPrivate<any>>this();
	},

	toString() {
		return <ReactiveDotPrivate<any>>this() + '';
	}
});


/** Unlink `dot`. private. */
function _unlink(target:ReactiveDotPrivate<any>, dot:ReactiveDotPrivate<any>) {
	const linked = target.linked;
	const _linked = target.linkedExists;

	linked.splice(linked.indexOf(dot), 1);
	delete _linked[dot.id];

	if (linked.length === 0) {
		if (dot.interactive === true) {
			dot.interactive = false;

			if (dot.options.teardown !== void 0) {
				dot.options.teardown.call(dot);
			}
		}
	}
}

/** Notify linked dots about the changes */
function _notify(dot:ReactiveDotPrivate<any>, currentValue:any, previousValue:any) {
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

rdot.dom = (el:HTMLInputElement):ReactiveDom => {
	const dot:ReactiveDom = rdot<string>(el.value, {
		setup() {
			//noinspection JSUnusedAssignment
			el.addEventListener('input', dot.handle);
		},

		teardown(): void {
			//noinspection JSUnusedAssignment
			dot.set(el.value);

			//noinspection JSUnusedAssignment
			el.removeEventListener('input', dot.handle);
		},

		setter(newValue:string): string {
			if (el.value !== newValue) {
				el.value = newValue;
			}

			return newValue;
		}
	});

	dot.el = el;
	dot.handle = () => dot.set(el.value);

	dot();

	return dot;
};

// Export
export default rdot;
