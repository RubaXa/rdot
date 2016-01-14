/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/expect.js/expect.js.d.ts" />
/// <reference path="../typings/should/should.d.ts" />

import rdot, {ReactiveDot, ReactiveDotPrivate} from '../src/rdot';

describe('Reactive Dot', () => {
	'use strict';

	describe('get/set', () => {
		it('without arguments / undefined', () => {
			let undefDot = rdot<any>();
			(undefDot() === void 0).should.equal(true);

			undefDot = rdot(void 0);
			(undefDot() === void 0).should.equal(true);
		});

		it('null', () => {
			const _null = rdot<any>(null);
			(_null() === null).should.equal(true);
		});

		it('primitive', () => {
			const str = rdot<string>('foo');
			const num = rdot<number>(0);

			str().should.equal(str.get());
			str.set('bar')().should.equal('bar');
			str.set('baz').get().should.equal('baz');

			num().should.equal(0);
			num.set(123).get().should.equal(123);
		});

		it('object', () => {
			const empty = {};
			const fooBar = {foo: 'bar'};
			const obj = rdot<any>(empty);

			obj().should.equal(empty);
			obj.set(fooBar).get().should.equal(fooBar);
		});

		it('getter', () => {
			const fn = rdot<string>(() => 'foo'); // почему?

			fn().should.equal('foo');
			fn.set(() => 'bar')().should.equal('bar');
			fn.set('baz')().should.equal('baz');
		});
	});

	describe('onValue', () => {
		it('once', () => {
			const dot = rdot<string>('initial');
			let res:string = 'fail';

			dot.onValue((val:string) => res = val);
			res.should.equal('initial');

			dot.set('changed');
			res.should.equal('changed');
		});

		it('multiple', () => {
			const dot = rdot<number>(1);
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
			const a = rdot<number>(2);
			const b = rdot<number>(3);
			const c = rdot<number>(10);
			const d = rdot<number>(() => a.valueOf() * b.valueOf() + c.valueOf());

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
			const a = rdot<number>(1);
			const b = rdot<number>(2);
			const c = rdot<number>(() => a() + b());

			let res:number = -1;

			(a as ReactiveDotPrivate<any>).linked.length.should.equal(0);
			c.onValue((x:number) => res = x);
			(a as ReactiveDotPrivate<any>).linked.length.should.equal(1);

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
			const local = rdot<string>('en', {sync: true});
			const name = rdot<string>('', {sync: true});
			const hi = rdot<string>('Hello', {sync: true});
			const def = rdot<string>(() => langs[local()], {sync: true});
			const eol = rdot<string>('!', {sync: true});
			const placeholder = rdot<string>(() => name() || def(), {sync: true});
			const msg:ReactiveDot<string> = rdot<string>(() => hi + ', ' + placeholder + eol, {sync: true});
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
		const c = rdot<number>(3, {sync: true});
		const b = rdot<number>(1, {sync: true});
		const a = rdot<number>(() => b() + c(), {sync: true});
		let res;

		a.onValue(x => res = x);

		it('b + *a, c + *a', () => {
			res.should.equal(4);
			(c as ReactiveDotPrivate<number>).linked.length.should.equal(1);
		});

		it('c + *b', () => {
			b.set(() => +c);
			res.should.equal(6);
			(c as ReactiveDotPrivate<number>).linked.length.should.equal(2);
		});

		it('c - *b', () => {
			b.set(5);
			res.should.equal(8);
			(c as ReactiveDotPrivate<number>).linked.length.should.equal(1);
		});

		it('b - *a, c - *a', () => {
			a.set(-1);
			res.should.equal(-1);
			(b as ReactiveDotPrivate<number>).linked.length.should.equal(0);
			(c as ReactiveDotPrivate<number>).linked.length.should.equal(0);
		});
	});

	describe('dom', () => {
		it('input', (done) => {
			const el = document.createElement('input');
			el.value = 'foo';

			const val = rdot.dom(el);

			val().should.equal('foo');
			val.set('bar');

			setTimeout(() => {
				el.value.should.equal('bar');
				done();
			}, 10);
		});
	});
});
