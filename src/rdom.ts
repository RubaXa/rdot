/// <reference path="../typings/xmlparser/xmlparser.d.ts" />

import ReactiveDot from './rdot';
import ReactiveArray from './rarray';
import xmlparser from 'xmlparserjs';


class VirtualNode {
	public dom:Node;
	public beforeMode:boolean = false;
	public value:string;
	public children:VirtualNode[] = [];

	private rdots:ReactiveDot<any>[];

	static factory(name:string, attrs:any[], events:any[]) {
		return new VirtualNode(name, attrs, events);
	}

	static createFragment(name:string):VirtualNode {
		const anchor:Node = document.createComment(name);
		return new VirtualNode(anchor)
	}

	constructor(before:Node);
	constructor(text:Node, value:string);
	constructor(name:string, attrs:any[], events:any[]);
	constructor(name, attrs?, events?) {
		if (name.nodeType) {
			this.dom = name;

			if (attrs == null) {
				this.beforeMode = true;
			} else {
				this.value = attrs;
			}
		} else {
			const dom = document.createElement(name);

			this.dom = dom;

			if (attrs !== null) {
				const length = attrs.length;

				for (let i = 0; i < length; i += 2) {
					((attr:string, expr:any) => {
						let value = expr;

						if (expr.apply !== void 0) {
							value = expr();

							this.rlink<any>(expr, (value) => {
								if (attr === 'value' || attr === 'checked') {
									if (dom[attr] !== value) {
										dom[attr] = value;
									}
								} else if (attr === 'class') {
									dom.className = value;
								} else {
									dom.setAttribute(attr, value);
								}
							});

							if (attr === 'value' || attr === 'checked') {
								dom.addEventListener(attr === 'checked' ? 'change' : 'input', (evt:Event) => {
									expr(null, evt.target[attr]);
								});
							}
						}

						if (attr === 'class') {
							dom.className = value;
						} else if (attr === 'value' || attr === 'checked') {
							dom[attr] = value;
						} else {
							dom.setAttribute(attr, value);
						}
					})(attrs[i], attrs[i + 1]);
				}
			}

			if (events !== null) {
				const length = events.length;

				for (let i = 0; i < length; i += 2) {
					((type:string, callback:Function) => {
						dom.addEventListener(type, (evt:Event) => {
							evt.preventDefault();
							callback(evt);
						}, false);
					})(events[i], events[i + 1]);
				}
			}
		}
	}

	add(node:string):this;
	add(node:Function):this;
	add(node:VirtualNode, index?:number):this;
	add(node, index?):this {
		let el:Node;

		if (node instanceof VirtualNode) {
			el = node.dom;
		} else {
			let value:string = node;

			if (typeof node === 'function') {
				value = node();

				this.rlink<string>(node, (value:string) => {
					el.nodeValue = value == null ? '' : value;
				});
			}

			el = document.createTextNode(value == null ? '' : value);
			node = new VirtualNode(el, value);
		}

		if (this.beforeMode) {
			this.children.push(node);
			this.dom.parentNode.insertBefore(el, this.dom); // todo: without DOM
		} else if (index == null) {
			this.dom.appendChild(el);
			this.children.push(node);
		} else {
			this.dom.insertBefore(el, this.dom.childNodes[index]); // todo: without DOM
			this.children.splice(index, 0, node);
		}

		return this;
	}

	addBlock(Block, getterProps) {
		if (!Block.Component) {
			Block.Component = function (props, propsKeys) {
				const inst = Object.create(Block.prototype);

				Block.call(inst);
				propsKeys.forEach(name => inst[name] = props[name]);

				return inst;
			};
			Block.Component.displayName = Block.name + 'Component';
			Object.keys(Block).forEach(name => Block.Component[name] = Block[name]);
		}

		const initProps:any = getterProps();
		const propsKeys = Object.keys(initProps);
		const inst = create(Block.Component, [initProps, propsKeys]);

		this.rlink<any>(getterProps, (props) => {
			propsKeys.forEach(name => inst[name] = props[name]);
		});

		return this.add(inst.vnode);
	}

	rlink<T>(getter:() => T, listener:(value:T) => void, initialCall:boolean = false) {
		const dot = new ReactiveDot<T>(getter).onValue(listener, initialCall);

		(this.rdots === void 0) && (this.rdots = []);
		this.rdots.push(dot);
	}

	vfor(getter:() => any[], callback) {
		let prevArray:any[] = [];

		this.rlink<any[]>(getter, (array:any[]) => {
			array.forEach((item:any, idx:number) => {
				if (prevArray[idx] !== array[idx]) {
					if (prevArray.length > idx) {
						this.children[0].empty(true);
						callback(this.children[0], array[idx]);
					} else {
						const frag = VirtualNode.createFragment(`vfor:${idx}`);

						this.add(frag);
						callback(frag, array[idx]);
					}
				}
			});

			if (array.length < prevArray.length) {
				this.children
					.splice(array.length, prevArray.length - array.length)
					.forEach(node => node.destroy(true))
				;
			}

			prevArray = array;
		}, true);

		return this;
	}

	vif(expr, factory) {
		const root:VirtualNode = VirtualNode.createFragment('IF');

		this.add(root);
		expr() && factory(root);

		this.rlink<boolean>(expr, (state:boolean) => {
			if (state) {
				factory(root);
			} else {
				root.empty();
			}
		});

		return this;
	}

	empty(removeDom:boolean = true) {
		const rdots = this.rdots;
		const children = this.children;

		if (rdots !== void 0) {
			let idx = rdots.length;

			if (idx === 1) {
				rdots[0].destroy();
			} else {
				while (idx--) {
					rdots[idx].destroy();
				}
			}
		}

		let idx = children.length;

		if (idx === 1) {
			children[0].destroy(removeDom);
		} else if (idx > 0) {
			while (idx--) {
				children[idx].destroy(removeDom);
			}
		}

		this.children = [];

		return this;
	}

	destroy(removeDom?:boolean) {
		this.empty(this.beforeMode);
		removeDom && this.dom.parentNode.removeChild(this.dom);
		this.dom = null;
	}
}

export function compile(Class:any):Function {
	if (Class.compiledTemplate) {
		return Class.compiledTemplate;
	}

	const tpl = Class.template;
	const blocks = Class.blocks || {};

	const fragment = xmlparser(tpl, null, {
		'#text'(value) {
			return value.replace(/\{(.*?)}/g, '<v>$1</v>');
		}
	});

	const rules = {
		'#root': () => ({children: []}),
		'#text': (node) => ({text: node.value}),

		'v'(node) {
			const expr = node.first.remove().value;
			return {expr: expr};
		},

		'for'(node, attrs) {
			return [`.vfor(function get() { return ${attrs.data}.get() }, function vfor(ROOT, ${attrs.as}) {ROOT`, `})`];
		},

		'if'(node, attrs) {
			return [`.vif(function get() {return !!${attrs.test} }, function vif(ROOT) {ROOT`, `})`];
		},

		'default'(node, attrs):any {
			if (blocks[node.name]) {
				const args:string = `function () {return {` + Object.keys(attrs).map(name => {
					const value:string = attrs[name];
					return `${name}: ${/^{/.test(value) ? toExpr(value.slice(1, -1)) : JSON.stringify(value)}`;
				}).join(',') + `}}`;

				return [`.addBlock(__blocks["${node.name}"], ${args})`, ``];
			} else {
				return {
					tag: node.name,
					attrs: node.attrs,
					children: []
				};
			}
		}
	};

	const toExpr = function toExpr(expr) {
		return expr.replace(/\b(this[\.\[])/g, '__$1');
	};

	const result = (function _next(node:INode, pad:string):any {
		const name = node.name;
		const worker = rules[name] || rules['default'];
		const tag = worker(node, node.attrs);
		const code = [];

		if (tag instanceof Array) {
			code.push(pad + toExpr(tag[0]));
			node.children.map(child => {
				const result = _next(child, pad + '  ');
				code.push(result.raw ? result.raw : `${pad}  .add(${result})`);
			});
			code.push(pad + toExpr(tag[1]));

			return {raw: code.join('\n')};
		} else if (tag.text) {
			return JSON.stringify(tag.text);
		} else if (tag.expr) {
			return 'function () { return ' + toExpr(tag.expr )+ ' }';
		} else {
			const attrs = [];
			const events = [];

			Object.keys(node.attrs).forEach(name => {
				const value = node.attrs[name];

				if (name.indexOf('on-') === 0) {
					const expr = toExpr(value.slice(1, -1));
					events.push(`"${name.substr(3)}"`, `function (evt) { ${expr}; }`);
				} else {
					let expr;

					if (value === true) {
						expr = value;
					} else if (value.indexOf('{') > -1){
						expr = toExpr(value.slice(1, -1));

						if (name === 'value' || name === 'checked') {
							expr = `function (dot, value) {
								if (arguments.length !== 2) {
									return ${expr};
								}
								${expr} = value;
							}`;
						} else {
							expr = `function () {return ${expr};}`;
						}
					} else {
						expr = JSON.stringify(value);
					}

					attrs.push(`"${name}"`, expr);
				}
			});

			code.push(
				`V("${tag.tag}", ` +
				`${attrs.length  ? `[${attrs.join(', ')}]` : 'null'}, ` +
				`${events.length  ? `[${events.join(', ')}]` : 'null'}` +
				`)`
			);

			node.children.map(child => {
				const result = _next(child, pad + '  ');
				code.push(result.raw || `${pad}  .add(${result})`);
			});

			return code.join('\n');
		}
	})(fragment.first, '');

	// console.log(result);

	//console.time(`${Class.displayName || Class.name}.compile`);

	const compiled:Function = Function('__this, __blocks, V', `return ${result};`);
	Class.compiledTemplate = compiled;

	//console.timeEnd(`${Class.displayName || Class.name}.compile`);
	//console.log(compiled);

	return compiled;
}

export function create(Class:any, args?:any[]) {
	const inst = new Class(...args);
	const compiledTemplate = compile(Class);

	//console.time(`${Class.displayName || Class.name}.create`);

	inst.vnode = compiledTemplate(inst, Class.blocks, VirtualNode.factory);
	inst['didMount'] && inst['didMount']();

	//console.timeEnd(`${Class.displayName || Class.name}.create`);

	return inst;
}

export function render(container:HTMLElement, Class:any, args:any[]) {
	const inst = create(Class, args);
	container.appendChild(inst.vnode.dom);

	return inst;
}

