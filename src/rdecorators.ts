import ReactiveDot, {RStream} from './rdot';
import ReactiveArray from './rarray';


function setGetSet(target:any, propertyName:string, getter:()=>any, setter:(value:any)=>void) {
	Object.defineProperty(target, propertyName, {
		get: getter,
		set: setter,
		enumerable: true
	});
}


function reactiveDecorator(depends:any[], initFn?:Function);
function reactiveDecorator(target:any, propertyName:string);
function reactiveDecorator(target, propertyName?) {
	if (target instanceof Array) {
		const depends = target;
		const length = depends.length;
		const initFn = propertyName;

		return function (target:any, propertyName:string) {
			const privateName = `__rdot:${propertyName}`;
			const propertyValue = target[propertyName];
			const isFunction = typeof propertyValue === 'function';

			setGetSet(target, propertyName,
				// Getter
				function () {
					let dot = this[privateName];

					if (dot === void 0) {
						dot = new ReactiveDot(() => {
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
				},

				// Setter
				function () {
					console.warn(`${propertyName} — readonly`);
				}
			);
		};
	} else {
		const privateName = `__rdot:${propertyName}`;

		setGetSet(target, propertyName,
			// Getter
			function () {
				let dot = this[privateName];
				return (
					(dot !== void 0) &&
					(dot instanceof RStream || dot instanceof ReactiveArray ? dot : dot.get())
				);
			},

			// Setter
			function (value) {
				let dot = this[privateName];

				if (value instanceof RStream) {
					this[privateName] = value;
					return;
				}

				if (value instanceof ReactiveDot) {
					value = value.getter;
				} else if (value instanceof Array || value instanceof ReactiveArray) {
					if (dot) {
						dot.setArray(value);
					} else {
						this[privateName] = (value instanceof ReactiveArray) ? value : ReactiveArray.from(value);
					}
					return;
				}

				if (dot === void 0) {
					this[privateName] = new ReactiveDot(value);
				} else {
					dot.set(value);
				}
			}
		);
	}
}

export const reactive = reactiveDecorator;
