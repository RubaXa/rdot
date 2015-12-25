describe('Reactive Dot :: Model', () => {
	describe('Model', () => {
		it('change', () => {
			var model = new rdot.Model({unread: false});
			var res = false;

			model.onChange.onValue(model => res = model.unread(), false);
			model.unread.set(true);
			res.should.equal(true);

			model.unread.set(123);
			res.should.equal(123);
		});
	});

	describe('List', () => {
		var list = new rdot.Model.List();
		var model = new rdot.Model({unread: false});
		var res = false;
		var cnt = 0;

		list.values.onValue(() => cnt = list.size(), false);
		list.values.onValue(() => res = list.get(0).unread(), false);

		list.push(model);

		it('length', () => {
			cnt.should.equal(1);
		});

		it('change', () => {
			model.unread.set(true);
			res.should.equal(true);

			model.unread.set(123);
			res.should.equal(123);
		});
	});
});
