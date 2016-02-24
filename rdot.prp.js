(factory => {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		define('rdot', [], factory);
	}
	else if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
		module.exports = factory(require('rdot'));
	}
	else {
		factory(window.rdot);
	}
})((rdot) => {
	'use strict';

	rdot.prototype.map = function map(fn) {
		return new rdot(() => fn(this.get(), this));
	};

	rdot.prototype.filter = function filter(fn) {
			let retVal;

			return new rdot(() => {
				const val = this.get();

				if (fn(val)) {
					retVal = val;
				}

				return retVal;
			}, {
				initialCall: false
			});
	};

	rdot.prototype.throttle = function throttle(msec) {
		let pid;
		let lock = false;
		let retVal;
		const apply = () => {
			pid = null;
			lock = true;
			dot.obsolete = true;
			dot();
			lock = false;
		};

		const dot = new rdot(() => {
			if (!pid) {
				retVal = this.get();
				!lock && (pid = setTimeout(apply, msec));
			}

			return retVal;
		});

		return dot;
	};

	rdot.prototype.not = function not() {
		return new rdot(() => !this.get());
	};

	rdot.prototype.assign = function assign(target, prop) {
		if (!prop && target.nodeType === 1) {
			prop = 'textContent';
		}

		this.onValue(val => {
			target[prop] = val;
		});

		return this;
	};

	rdot.prototype.arrayFilter = function arrayFilter(fn) {
		const dot = new rdot(() => {
			const data = fn(this.get());
			const prev = dot.__arrayFilter || [];
			const filtered = [];
			const array = data.array;
			const callback = data.callback;

			let changed = false;

			for (let i = 0, n = array.length; i < n; i++) {
				if (callback(array[i], i, array)) {
					filtered.push(array[i]);
					changed = changed || array[i] !== prev[i];
				} else {
					changed = true;
				}
			}

			dot.__arrayFilter = (changed ? filtered : dot.__arrayFilter || array.slice(0));

			return changed && (array.length !== filtered.length) ? filtered : array;
		});

		return dot;
	};
});
