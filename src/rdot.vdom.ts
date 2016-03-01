/// <reference path="../typings/citojs/citojs.d.ts" />

import {vdom} from 'citojs';

const R_ATTRS:RegExp = /\s([^=]+)="(.*?)"/g;
const R_EXPR:RegExp = /\{%\s([\s\S]*?)\s%\}/g;
const R_IS_STRICT_EXPR:RegExp = /^\{%\s(.*?)\s%\}$/;
const NULL_FRAG = {tag: '!'};

function toVDOM(code:string):string {
	code = code.replace(/(\s*)<([a-z0-9:-]+)((?:\s[a-z-]+="[^"]+")*)>([\s\S]*?)\1<\/\2>/g, (_, padding, tag, attrsString, content, idx) => {
		return ',' + padding + toVDOMNode(tag, attrsString, content);
	});

	code = code.replace(/<([a-z0-9-]+)(\s.+)?\/>/g, (_, tag, attrsString) => {
		return ',' + toVDOMNode(tag, attrsString);
	});

	return code;
}

function toVDOMNode(tag:string, attrsString:string, content?:string) {
	const attrs:{[index:string]: string} = {};
	const events:{[index:string]: string} = {};

	let code:string = ``;
	let matches:string[];
	let hasAttrs:boolean = false;
	let hasEvents:boolean = false;

	while (matches = R_ATTRS.exec(attrsString)) {
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
		code += `, attrs: {${Object.keys(attrs).map((name:string) => `${name}: ${interpolate(attrs[name])}`).join(', ')}}`;
	}

	if (hasEvents) {
		code += `, events: {${Object.keys(events).map((name:string) => `${name}: ${events[name].slice(3, -3)}`).join(', ')}}`;
	}

	if (content) {
		if (/<\w+/.test(content)) {
			code += `, children: [${toVDOM(content)}]`;
		} else {
			code += `, children: ${interpolate(content)}`;
		}
	}

	return `{tag: "${tag}"${code}}`;
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

	// Доделываем
	code = code.replace(R_EXPR, ', __rdom.frag(() => $1 ) ');

	// Чистим запятые
	code = code.replace(/([\(\[])\s*?,/g, '$1');

	// Убираем лишнии кавычки
	code = code.replace(/\?\s*"\s*,/g, '? ');
	code = code.replace(/"\s*:(\s*"\s*,)?/g, ' : ');

	console.log(code);

	return Function('__rdom', 'return ' + code)({
		frag(getter) {
			return () => {
				return getter() || NULL_FRAG;
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
	console.log(fragment);
	vdom.append(el, fragment);
}
