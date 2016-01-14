(factory => {
	'use strict';

	// Так как `ReactiveDot` расширяет прототип `Function`, нужно сделать так,
	// это никак не влияло на приложение, т.е. получить свой `Function` и использовать его.
	// Для этого, создаем iframe, вставляем код в него через `document.write` и уже его возвращаем.
	// Это трюк позволяет получить `Function `из `iframe` и делать с ним что угодно.
	//const head = document.head || document.getElementsByTagName('head')[0];
	//let iframe = document.createElement('iframe');
	//
	//head.appendChild(iframe);
	//iframe.contentWindow.reactiveExport = (fn) => factory = fn;
	//iframe.contentDocument.write('<script>reactiveExport(' + factory.toString() + ')</script>');
	//head.removeChild(iframe);
	//iframe = null;

	if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
		module.exports = factory();
	} else {
		window['rdot'] = factory();
	}
})(function reactiveDotFactory() {
	'use strict';

	/**
	 * Reactive Dot Structure.
	 * @typedef    {Function}       ReactiveDot
	 * @protected  {Function}       get           get actual value
	 * @protected  {Function}       set           set new value / getter
	 * @protected  {Function}       onValue       Function will be called for each new value
	 * @protected  {*}              value         previous actual value (readonly)
	 * @protected  {boolean}        obsolete      The value will be calculated at the next call (readonly)
	 * @protected  {boolean}        computing
	 * @protected  {boolean}        constant
	 * @protected  {boolean}        interactive
	 * @protected  {function}       getter
	 * @protected  {ReactiveDot[]}  linked
	 * @protected  {ReactiveDot[]}  dependsOn
	 */

	/**
	 * Global incremetal id
	 * @type {number}
	 */
	let gid = 0;

	/** @type {ReactiveDot} */
	let _activeDot;

	/** @type {ReactiveDot[]} */
	let _queue = [];
	let _queueMap = {};

	let _revision = 0;
	let _computing = void 0;

	const defaultOptions = {};

	function _add2Queue(dot) {
		if (_queueMap[dot.id] === void 0) {
			dot.obsolete = true;

			_queue.push(dot);
			_queueMap[dot.id] = true;
		}
	}

	function _computingAll() {
		if (_computing !== void 0) {
			_computing = void 0;
			_revision++;

			let length = 0;

			do {
				let dot = _queue[length];
				let linked = dot.linked;

				// computing
				dot();

				if (linked) {
					for (let i = 0; i < linked.length; i++) {
						_add2Queue(linked[i]);
					}
				}

				length++;
			} while (length < _queue.length);

			_queue = [];
			_queueMap = {};
		}
	}

	/**
	 * Get value
	 * @this   ReactiveDot
	 * @return {ReactiveDot}
	 */
	function fn_get() {
		return this();
	}

	/**
	 * Set new value
	 * @this   ReactiveDot
	 * @param  {*} value
	 * @return {ReactiveDot}
	 */
	function fn_set(value) {
		const dot = this;

		dot.constant = typeof value !== 'function';
		dot.getter = value;
		dot.obsolete = true;

		_add2Queue(dot);

		if (_computing === void 0) {
			_computing = setTimeout(_computingAll, 0);
		}

		return dot;
	}

	/**
	 * Subscribes a given handler function to rdot.
	 * @this   ReactiveDot
	 * @param  {Function} fn
	 * @param  {boolean}  [initialCall]
	 * @return {ReactiveDot}
	 */
	function fn_onValue(fn, initialCall) {
		if (initialCall !== false && this.options.initialCall !== false) {
			fn(this());
		} else {
			this(); // Init
		}

		if (this._onValue === void 0) {
			this._onValue = fn;
		} else {
			this._onValue = [].concat(this._onValue, fn); // slowest
		}

		return this;
	}

	/** @this ReactiveDot */
	function fn_valueOf() {
		return this();
	}

	/** @this ReactiveDot */
	function fn_toString() {
		return this() + '';
	}

	/**
	 * Unlink `dot`
	 * @param {ReactiveDot} target
	 * @param {ReactiveDot} dot
	 * @private
	 */
	function _unlink(target, dot) {
		const linked = target.linked;
		const _linked = target._linked;

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

	/**
	 * Notify linked dots about the changes.
	 * @param  {ReactiveDot}   dot
	 * @param  {*} currentValue
	 * @param  {*} previousValue
	 * @private
	 */
	function notify(dot, currentValue, previousValue) {
		const _onValue = dot._onValue;

		if (_onValue !== void 0) {
			if (arguments.length > 1) {
				if (_onValue[0] === void 0) {
					_onValue(currentValue, previousValue);
				} else {
					_onValue.forEach(fn => fn(currentValue, previousValue)); // slowest
				}
			}
		}
	}

	/**
	 * Create a reactive dot
	 * @param  {*}  value
	 * @param  {function|object} [options]
	 * @return {ReactiveDot}
	 */
	const rdot = function newReactiveDot(value, options) {
		if (options === void 0) {
			options = defaultOptions;
		}
		if (typeof options === 'function') {
			options = {setter: options};
		}

		let _setter = options.setter;

		/**
		 * Reactive Dot
		 * @return {*}
		 */
		let dot = function reactiveDot() {
			if (_computing !== void 0) {
				_computingAll();
			}

			let currentValue = dot.value;
			let previousValue = currentValue;
			let previousActiveDot = _activeDot;
			let changed;

			if (_activeDot !== void 0) {
				if (dot._linked[_activeDot.id] === void 0) {
					dot._linked[_activeDot.id] = true;
					dot.linked.push(_activeDot);

					_activeDot.dependsOn.push(dot);
				}

				_activeDot._dependsOn[dot.id] = _activeDot.tick;
				//console.log('setTick.dot: %d, prev: %d, active: %d', dot.id, dependsOnTick, _activeDot.tick);
			}

			if (dot.revision !== _revision) {
				//console.log('dot: %d, tick: %d, rev: %d (new: %d)', dot.id, dot.tick, dot.revision, _revision);

				dot.revision = _revision;

				// Значение устарело, требуется перерасчет
				dot.tick++;

				if (dot.interactive === false) {
					// Переводим в интерактивное состояние
					dot.interactive = true;
					options.setup && options.setup.call(dot);

					if (!dot.obsolete) {
						// Похоже в setup, уже вычеслили значение, точнее просто вызвали getter
						return dot.value;
					}
				}

				// Computing value
				//console.log('getter.dot: %d, rev: %d, tick: %d', dot.id, _revision, dot.tick);
				_activeDot = dot;
				currentValue = dot.constant ? dot.getter : dot.getter(dot);
				_activeDot = previousActiveDot;

				if (_setter !== void 0) {
					currentValue = _setter(currentValue, previousValue);
				}

				changed = previousValue !== currentValue;

				dot.value = currentValue;
				dot.obsolete = false;

				if (changed) {
					notify(dot, currentValue, previousValue);
				}

				// Проверяем точки, от которых мы зависим
				let dependsOn = dot.dependsOn;
				let _dependsOn = dot._dependsOn;
				let idx = dependsOn.length;

				if (idx !== 0) {
					let depDot;
					let tick = dot.tick;
					//console.log('dependsOn.check: %d, tick: %d', dot.id, dot.tick);

					while (idx--) {
						depDot = dependsOn[idx];
						//console.log('dependsOn.id: %d, cur.tick: %d, eq.tick: %d', depDot.id, _dependsOn[depDot.id], tick);

						if (_dependsOn[depDot.id] !== tick) {
							console.warn('unlink.dot: %d, from.dot: %d', dot.id, depDot.id);
							_unlink(depDot, dot);
						}
					}
				}
			}


			return currentValue;
		};

		for (var key in rdot.fn) {
			dot[key] = rdot.fn[key];
		}

		// Readonly
		dot.id = ++gid;
		dot.constant = typeof value !== 'function';
		dot.getter = value;
		dot.options = options;

		dot.linked = [];
		dot._linked = {};

		dot.dependsOn = [];
		dot._dependsOn = {};

		return dot;
	};


	/**
	 * Расширение методов ReactiveDot
	 */
	rdot.fn = {};
	rdot.fn.extend = function (methods) {
		for (let key in methods) {
			this[key] = methods[key];
		}
	};

	// Определяем основные методы
	rdot.fn.extend({
		// Readonly
		id: null,
		tick: 0,
		obsolete: true,
		interactive: false,

		// Методы
		get: fn_get,
		set: fn_set,
		onValue: fn_onValue,
		valueOf: fn_valueOf,
		toString: fn_toString
	});

	/**
	 * Create a reactive dot and bind it with HTMLElement
	 * @param  {HTMLElement} el
	 * @return {ReactiveDot}
	 */
	rdot.dom = function dom(el) {
		const dot = rdot(el.value, {
			setup() {
				dot.handle = () => {
					dot.set(el.value);
				};
				el.addEventListener('input', dot.handle);
			},

			teardown() {
				dot(el.value);
				el.removeEventListener('input', dot.handle);
				delete dot.handle;
			}
		});

		dot.el = el;
		dot.set = function (value) {
			if (dot.value !== value) {
				el.value = value;
			}

			return fn_set.call(this, value);
		};

		dot();

		return dot;
	};

	/**
	 * Реактивное значение на основе события
	 * @param  {HTMLElement} el
	 * @param  {string}      event
	 * @return {ReactiveDot}
	 */
	rdot.fromEvent = function (el, event) {
		return rdot(new Event(event), {
			setup() {
				this.handle = (evt) => this.set(evt);
				el.addEventListener(event, this.handle);
			},

			teardown() {
				this(null);
				el.removeEventListener(event, this.handle);
			}
		})
	};

	rdot.notify = notify;

	/**
	 * Combines two or more dots together
	 * @param  {ReactiveDot[]}  dots
	 * @param  {Function}       [combinator]
	 * @return {ReactiveDot}
	 */
	rdot.combine = function (dots, combinator) {
		const length = dots.length;

		return rdot(() => {
			let dot;
			let idx = length;
			let results = new Array(length);

			while (idx--) {
				dot = dots[idx];
				results[idx] = dot ? (dot.fetch ? dot.fetch() : (dot.onValue ? dot() : dot)) : dot;
			}

			return combinator ? combinator.apply(null, results) : results;
		});
	};

	// Export
	return rdot;
});
