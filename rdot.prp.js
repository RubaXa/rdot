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

	rdot.extend({
		map(fn) {
			return rdot(() => fn(this(), this));
		},

		filter(fn) {
			let retVal;

			return rdot(() => {
				const val = this();

				if (fn(val)) {
					retVal = val;
				}

				return retVal;
			}, {
				initialCall: false
			});
		},

		throttle(msec) {
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

			const dot = rdot(() => {
				if (!pid) {
					retVal = this();
					!lock && (pid = setTimeout(apply, msec));
				}

				return retVal;
			});

			return dot;
		},

		not() {
			return rdot(() => !this());
		},

		assign(target, prop) {
			if (!prop && target.nodeType === 1) {
				prop = 'textContent';
			}

			this.onValue(val => {
				target[prop] = val;
			});

			return this;
		},

		arrayFilter(fn) {
			const dot = rdot(() => {
				const data = fn(this());
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
		}
	});
});
