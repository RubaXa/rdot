describe('Reactive Dot :: PRP', () => {
	'use strict';

	it('map', () => {
		let res = 0;

		rdot(123).map(x => x * 2).onValue(x => res = x);
		res.should.equal(246);
	});

	it('filter', () => {
		let res = [];
		const dot = rdot(0);

		dot.filter(x => x % 2).onValue(x => res.push(x));
		dot.set(1);
		dot.set(2);
		dot.set(3);

		res.should.deepEqual([1,3]);
	});
});
