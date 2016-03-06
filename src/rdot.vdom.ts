/// <reference path="../typings/citojs/citojs.d.ts" />

import {vdom} from 'citojs';
import ReactiveDot from './rdot';

const DEBUG:boolean = false;
const R_ATTRS:RegExp = /\s([^=]+)="(.*?)"/g;
const R_EXPR:RegExp = /\{%\s([\s\S]*?)\s%\}/g;
const R_HAS_EXPR:RegExp = /\{%\s([\s\S]*?)\s%\}/;
const R_IS_STRICT_EXPR:RegExp = /^\{%\s(.*?)\s%\}$/;

function reactiveBind(ctx:any, fn:Function):Function {
	return function reactiveBinded() {
		return (arguments.length ? fn.apply(ctx, arguments) : fn.call(ctx)) || {tag: '!'};
	};
}

function toVDOM(code:string):string {
	code = code.replace(/(\s*)<([a-z0-9:-]+)((?:\s[a-z-]+="[^"]+")*)>([\s\S]*?)\1<\/\2>/g, (_, padding, tag, attrsString, content, idx) => {
		return ',' + padding + toVDOMNode(tag, attrsString, content);
	});

	code = code.replace(/<([a-z0-9-]+)(\s.+)?\/>/g, (_, tag, attrsString) => {
		return ',' + toVDOMNode(tag, attrsString);
	});

	return code;
}

function toVDOMNode(tag:string, unparsedAttrs:string, content?:string) {
	const attrs:{[index:string]: string} = {};
	const events:{[index:string]: string} = {};

	let code:string = ``;
	let matches:string[];
	let attrsStr:string = '';
	let hasReactiveAttrs:boolean = false;
	let hasAttrs:boolean = false;
	let hasEvents:boolean = false;

	while (matches = R_ATTRS.exec(unparsedAttrs)) {
		const attr:string = matches[1];
		let value:string = matches[2];

		if (attr === 'key') {
			code += `, key: ${interpolate(value)}`;
		} else if (/^on-/.test(attr)) {
			hasEvents = true;
			events[attr.substr(3)] = value;
		} else {
			hasAttrs = true;
			attrs[attr] = value;
		}
	}

	if (hasAttrs) {
		attrsStr = '{' + Object.keys(attrs).map((name:string) => {
			let value:string = attrs[name];

			if (R_HAS_EXPR.test(value)) {
				value = interpolate(value);
				hasReactiveAttrs = true;
			} else {
				value = interpolate(value);
			}

			return `${name}: ${value}`;
		}).join(', ') + '}';

		if (!hasReactiveAttrs) {
			code += `, attrs: ${attrsStr}`;
		}
	}

	if (hasEvents) {
		code += `, events: {${Object.keys(events).map((name:string) => `${name}: ${events[name].slice(3, -3)}`).join(', ')}}`;
	}

	if (content) {
		if (/<\w+/.test(content)) {
			code += `, children: [${toVDOM(content)}]`;
		} else {
			if (R_HAS_EXPR.test(content)) {
				content = `__rdom.content(this, function(){return(${interpolate(content)})})`;
			} else {
				content = interpolate(content);
			}

			code += `, children: ${content}`;
		}
	}

	code = `{tag: "${tag}"${code}}`;

	if (hasReactiveAttrs) {
		code = `__rdom.attrs(this, function(){return(${attrsStr})}, ${code})`;
	}

	return code;
}

function interpolate(value:string):string {
	return R_IS_STRICT_EXPR.test(value) ? value.slice(3, -3) : JSON.stringify(value).replace(R_EXPR, '" + $1 + "');
}


const specialChar = {
	'n': '\n',
	't': '\t'
};

export function compile(source:string):()=>any {
	let code:string = source;

	// Бредятина
	code = code
			.replace(/\\(.)/g, (_, chr) => specialChar[chr] || chr)
			.replace(/["']\s*\+\s*/g, '{% ')
			.replace(/\s*\+\s*['"]/g, ' %}')
			.replace(/(return)\s*\(?"/g, '$1(')
			.replace(/"\)?;/g, ');')
	;


	// Конвертируем в vdom
	code = toVDOM(code);

	// Доробатываем реактивные выражения, типа циклов и треннарных опретаторов
	let _code:string;
	do {
		_code = code;
		code = code.replace(R_EXPR, ', __rdom.frag(this, function(){return($1)}) ');
	} while (_code !== code);

	// Чистим запятые
	code = code.replace(/([\(\[])\s*?,/g, '$1');

	// Убираем лишнии кавычки
	code = code.replace(/\?\s*"\s*,/g, '? ');
	code = code.replace(/"\s*:(\s*"\s*,)?/g, ' : ');

	//console.log(code);

	// Компилируем
	return Function('__rdom', 'return ' + code)({
		frag(_this, getter) {
			getter = reactiveBind(_this, getter);

			return function reactiveFragment(prevFrag) {
				const dot = new ReactiveDot<any>(getter);
				let frag:any = dot.get();

				DEBUG && console.log('create.frag:', frag, prevFrag);
				prevFrag && (prevFrag.dot as ReactiveDot<any>).dispose();
				(frag instanceof Array) && (frag = {children: frag});

				dot.onValue(newFrag => {
					DEBUG && console.log('update.frag:', newFrag, frag);
					(newFrag instanceof Array) && (newFrag = {children: newFrag});
					vdom.update(frag, newFrag);
					frag.dot = dot;
				}, false);

				frag.dot = dot;

				return frag;
			};
		},

		content(_this, getter) {
			getter = reactiveBind(_this, getter);

			return function reactiveContent(prevFrag, parent) {
				const dot = new ReactiveDot<any>(getter);
				const node:any = {tag: '#', children: dot.get()};

				prevFrag && (prevFrag.dot as ReactiveDot<any>).dispose();
				node.dot = dot;
				DEBUG && console.log('create.content:', node, prevFrag);

				dot.onValue(content => {
					DEBUG && console.log('update.content:', content);
					(node.dom || parent.dom).textContent = content;
				}, false);

				return node;
			};
		},

		attrs(_this, getter, node) {
			getter = reactiveBind(_this, getter);

			return function () {
				const dot = new ReactiveDot<any>(getter);

				dot.onValue((attrs:any) => {
					vdom.updateAttributes(node.dom, node.tag, node.ns, attrs, node.attrs);
					node.attrs = attrs;
				}, false);

				node.attrs = dot.get();

				return node;
			};
		}
	});
}

export function render(el:HTMLElement, target:any) {
	if (target.render['compiled'] === void 0) {
		target.render = compile(target.render.toString());
		target.render['compiled'] = true;
	}

	const fragment:any = target.render();
	//console.log(fragment);
	return vdom.append(el, fragment);
}
