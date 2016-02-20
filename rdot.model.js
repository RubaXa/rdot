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

	class Model {
		constructor(attrs) {
			this.onChange = rdot(() => this);

			for (let key in attrs) {
				this[key] = rdot(attrs[key]);
				this[key]();

				this[key].onValue(() => {
					rdot.forceCompute(this.onChange);
				}, false);
			}
		}
	}

	class List {
		constructor() {
			this._items = [];
			this.values = rdot(this._items);
		}

		fetch(fn) {
			return fn ? this.values.onValue(fn) : this.values();
		}

		_regItem(item) {
			item.onChange.onValue(() => {
				rdot.forceCompute(this.values);
			}, false);

			this._emitChange();
		}

		_emitChange() {
			if (!this.__pid) {
				this.__pid = setTimeout(() => {
					this.__pid = null;
					this.values.set(this._items.slice(0));
				});
			}
		}

		push(item) {
			const idx = this._items.push(item);
			this._regItem(item);
			return idx;
		}

		unshift(item) {
			const idx = this._items.unshift(item);
			this._regItem(item);
			return idx;
		}

		remove(item) {
			const idx = this._items.indexOf(item);

			if (idx > -1) {
				this._items.splice(idx, 1);
				this._emitChange();
			}
		}

		get(idx) {
			return idx >= 0 ? this.values()[idx] : this.values();
		}

		size() {
			return this.values().length;
		}

		map(fn) {
			return this.values.map(fn);
		}
	}


	// Export
	Model.List = List;
	rdot.Model = Model;
});
