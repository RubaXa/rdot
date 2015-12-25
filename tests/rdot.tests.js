describe('Reactive Dot', () => {
	'use strict';

	describe('get/set', () => {
		it('core: get/set', () => {
			let val = rdot('foo');

			val().should.equal(val.get());
			val.set('bar')().should.equal(val.get());
			val.set('baz').get().should.equal(val());
		});

		it('without arguments / undefined', () => {
			let undef = rdot();
			(undef() === void 0).should.equal(true);

			undef = rdot(void 0);
			(undef() === void 0).should.equal(true);
		});

		it('null', () => {
			const _null = rdot(null);
			(_null() === null).should.equal(true);
		});

		it('primitive', () => {
			const num = rdot(0);

			num().should.equal(0);
			num.set(123)().should.equal(123);
		});

		it('object', () => {
			const obj = rdot({});

			obj().should.deepEqual({});
			obj.set({foo: 'bar'})().should.deepEqual({foo: 'bar'});
		});

		it('getter', () => {
			const fn = rdot(() => 'foo');

			fn().should.equal('foo');
			fn.set(() => 'bar')().should.equal('bar');
			fn.set('baz')().should.equal('baz');
		});
	});

	describe('onValue', () => {
		it('once', () => {
			const dot = rdot('initial');
			let res;

			dot.onValue(val => res = val);
			res.should.equal('initial');

			dot.set('changed');
			res.should.equal('changed');
		});

		it('multiple', () => {
			const dot = rdot(1);
			let log = [];

			dot.onValue(val => log.push(val * 1));
			dot.onValue(val => log.push(val * 2));
			dot.onValue(val => log.push(val * 3));

			log.should.deepEqual([1, 2, 3]);

			dot.set(2);
			log.should.deepEqual([1, 2, 3, 2, 4, 6]);
		});
	});

	describe('linked', () => {
		it('d => a * b + c (only Math expressions)', () => {
			const a = rdot(2);
			const b = rdot(3);
			const c = rdot(10);
			const d = rdot(() => a * b + c);

			let res;
			d.onValue(x => res = x);
			res.should.equal(16);

			a.set(1);
			d.onValue(x => res = x);
			res.should.equal(13);

			c.set(5);
			d.onValue(x => res = x);
			res.should.equal(8);
		});

		it('c => a() + b()', () => {
			const a = rdot(1);
			const b = rdot(2);
			const c = rdot(() => a() + b());

			let res;
			c.onValue(x => res = x);

			res.should.equal(3);

			a.set(-5);
			res.should.equal(-3);

			b.set(5);
			res.should.equal(0);
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
			const local = rdot('en');
			const name = rdot('');
			const hi = rdot('Hello');
			const def = rdot(() => langs[local()]);
			const eol = rdot('!');
			const placeholder = rdot(() => name() || def());
			const msg = rdot(() => hi + ', ' + placeholder + eol);
			let res;

			msg.onValue(x => res = x);
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
		const c = rdot(3);
		const b = rdot(1);
		const a = rdot(a => b + c);
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
			b.linked.length.should.equal(0);
			c.linked.length.should.equal(0);
		});
	});

	describe('dom', () => {
		it('input', () => {
			const el = document.createElement('input');
			el.value = 'foo';

			const val = rdot.dom(el);

			val().should.equal('foo');
			val.set('bar');

			el.value.should.equal('bar');
		});
	});
});
