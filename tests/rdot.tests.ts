/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/expect.js/expect.js.d.ts" />
/// <reference path="../typings/should/should.d.ts" />

import RDot from '../src/rdot';

describe('Reactive Dot', () => {
	'use strict';

	describe('get/set', () => {
		it('without arguments / undefined', () => {
			let undefDot = new RDot<any>();
			(undefDot.get() === void 0).should.equal(true);

			undefDot = new RDot(void 0);
			(undefDot.get() === void 0).should.equal(true);
		});

		it('null', () => {
			const _null = new RDot<any>(null);
			(_null.get() === null).should.equal(true);
		});

		it('primitive', () => {
			const str = new RDot<string>('foo');
			const num = new RDot<number>(0);

			str.get().should.equal(str.get());
			str.set('bar').get().should.equal('bar');
			str.set('baz').get().should.equal('baz');

			num.get().should.equal(0);
			num.set(123).get().should.equal(123);
		});

		it('object', () => {
			const empty = {};
			const fooBar = {foo: 'bar'};
			const obj = new RDot<any>(empty);

			obj.get().should.equal(empty);
			obj.set(fooBar).get().should.equal(fooBar);
		});

		it('getter', () => {
			const fn = new RDot<string>(() => 'foo'); // почему?

			fn.get().should.equal('foo');
			fn.set(() => 'bar').get().should.equal('bar');
			fn.set('baz').get().should.equal('baz');
		});
	});

	describe('onValue', () => {
		it('once', () => {
			const dot = new RDot<string>('initial');
			let res:string = 'fail';

			dot.onValue((val:string) => res = val);
			res.should.equal('initial');

			dot.set('changed');
			res.should.equal('changed');
		});

		it('multiple', () => {
			const dot = new RDot<number>(1);
			const log:number[] = [];

			dot.onValue((val:number) => log.push(val));
			dot.onValue((val:number) => log.push(val * 2));
			dot.onValue((val:number) => log.push(val * 3));

			log.join().should.equal([1, 2, 3].join());

			dot.set(2);
			log.join().should.equal([1, 2, 3, 2, 4, 6].join());
		});
	});

	describe('linked', () => {
		it('d => a * b + c (only Math expressions)', () => {
			const a = new RDot<number>(2);
			const b = new RDot<number>(3);
			const c = new RDot<number>(10);
			const d = new RDot<number>(() => a.valueOf() * b.valueOf() + c.valueOf());

			let res:number = -1;
			d.onValue((x:number) => res = x);
			res.should.equal(16);

			a.set(1);
			d.onValue((x:number) => res = x);
			res.should.equal(13);

			c.set(5);
			d.onValue((x:number) => res = x);
			res.should.equal(8);
		});

		it('c => a() + b() (async)', (done) => {
			const a = new RDot<number>(1);
			const b = new RDot<number>(2);
			const c = new RDot<number>(() => a.get() + b.get());

			let res:number = -1;

			a.linked.length.should.equal(0);
			c.onValue((x:number) => res = x);
			a.linked.length.should.equal(1);

			res.should.equal(3);

			a.set(-5);

			setTimeout(() => {
				res.should.equal(-3);

				a.set(123);
				b.set(321);
				res.should.equal(-3); // not changed

				setTimeout(() => {
					res.should.equal(444);
					done();
				}, 10);
			}, 10);
		});

		it('Hello world!', () => {
			/*
			 {Hello}, {placeholder}{!}
			 /           |         \
			 hi      placeholder    eol
			 /    \
			 (name || default)
			 /  \
			 local  lang
			 */

			const langs = {'ru': 'мир', 'en': 'world'};
			const local = new RDot<string>('en', {sync: true});
			const name = new RDot<string>('', {sync: true});
			const hi = new RDot<string>('Hello', {sync: true});
			const def = new RDot<string>(() => langs[local.get()], {sync: true});
			const eol = new RDot<string>('!', {sync: true});
			const placeholder = new RDot<string>(() => name.get() || def.get(), {sync: true});
			const msg:RDot<string> = new RDot<string>(() => hi + ', ' + placeholder + eol, {sync: true});
			let res:string = 'fail';

			msg.onValue((x:string) => res = x);
			res.should.equal('Hello, world!');

			eol.set('?');
			res.should.equal('Hello, world?');

			local.set('ru');
			res.should.equal('Hello, мир?');

			hi.set('Hi');
			eol.set('!1');
			name.set('%username%');
			res.should.equal('Hi, %username%!1');
		});
	});

	describe('unlinking', () => {
		// 1. a => b + c --> c (1)
		// 2. a => (b => c) + c --> c (2)
		// 3. a => b + c --> c (1)
		const c = new RDot<number>(3, {sync: true});
		const b = new RDot<number>(1, {sync: true});
		const a = new RDot<number>(() => b.get() + c.get(), {sync: true});
		let res;

		a.onValue(x => res = x);

		it('b + *a, c + *a', () => {
			res.should.equal(4);
			c.linked.length.should.equal(1);
		});

		it('c + *b', () => {
			b.set(() => +c);
			res.should.equal(6);
			c.linked.length.should.equal(2);
		});

		it('c - *b', () => {
			b.set(5);
			res.should.equal(8);
			c.linked.length.should.equal(1);
		});

		it('b - *a, c - *a', () => {
			a.set(-1);
			res.should.equal(-1);
			c.linked.length.should.equal(0);
			c.linked.length.should.equal(0);
		});
	});

	describe('dom', () => {
		it('input', (done) => {
			const el = document.createElement('input');
			el.value = 'foo';

			const val = RDot.dom(el);

			val.get().should.equal('foo');
			val.set('bar');

			setTimeout(() => {
				el.value.should.equal('bar');
				done();
			}, 10);
		});
	});
});
