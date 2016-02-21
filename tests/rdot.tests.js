/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/expect.js/expect.js.d.ts" />
/// <reference path="../typings/should/should.d.ts" />
(function (factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(["require", "exports", '../src/rdot'], factory);
    }
})(function (require, exports) {
    var rdot_1 = require('../src/rdot');
    describe('Reactive Dot', function () {
        'use strict';
        describe('get/set', function () {
            it('without arguments / undefined', function () {
                var undefDot = new rdot_1["default"]();
                (undefDot.get() === void 0).should.equal(true);
                undefDot = new rdot_1["default"](void 0);
                (undefDot.get() === void 0).should.equal(true);
            });
            it('null', function () {
                var _null = new rdot_1["default"](null);
                (_null.get() === null).should.equal(true);
            });
            it('primitive', function () {
                var str = new rdot_1["default"]('foo');
                var num = new rdot_1["default"](0);
                str.get().should.equal(str.get());
                str.set('bar').get().should.equal('bar');
                str.set('baz').get().should.equal('baz');
                num.get().should.equal(0);
                num.set(123).get().should.equal(123);
            });
            it('object', function () {
                var empty = {};
                var fooBar = { foo: 'bar' };
                var obj = new rdot_1["default"](empty);
                obj.get().should.equal(empty);
                obj.set(fooBar).get().should.equal(fooBar);
            });
            it('getter', function () {
                var fn = new rdot_1["default"](function () { return 'foo'; }); // почему?
                fn.get().should.equal('foo');
                fn.set(function () { return 'bar'; }).get().should.equal('bar');
                fn.set('baz').get().should.equal('baz');
            });
        });
        describe('onValue', function () {
            it('once', function () {
                var dot = new rdot_1["default"]('initial');
                var res = 'fail';
                dot.onValue(function (val) { return res = val; });
                res.should.equal('initial');
                dot.set('changed');
                res.should.equal('changed');
            });
            it('multiple', function () {
                var dot = new rdot_1["default"](1);
                var log = [];
                dot.onValue(function (val) { return log.push(val); });
                dot.onValue(function (val) { return log.push(val * 2); });
                dot.onValue(function (val) { return log.push(val * 3); });
                log.join().should.equal([1, 2, 3].join());
                dot.set(2);
                log.join().should.equal([1, 2, 3, 2, 4, 6].join());
            });
        });
        describe('linked', function () {
            it('d => a * b + c (only Math expressions)', function () {
                var a = new rdot_1["default"](2);
                var b = new rdot_1["default"](3);
                var c = new rdot_1["default"](10);
                var d = new rdot_1["default"](function () { return a.valueOf() * b.valueOf() + c.valueOf(); });
                var res = -1;
                d.onValue(function (x) { return res = x; });
                res.should.equal(16);
                a.set(1);
                d.onValue(function (x) { return res = x; });
                res.should.equal(13);
                c.set(5);
                d.onValue(function (x) { return res = x; });
                res.should.equal(8);
            });
            it('c => a() + b() (async)', function (done) {
                var a = new rdot_1["default"](1);
                var b = new rdot_1["default"](2);
                var c = new rdot_1["default"](function () { return a.get() + b.get(); });
                var res = -1;
                a.linked.length.should.equal(0);
                c.onValue(function (x) { return res = x; });
                a.linked.length.should.equal(1);
                res.should.equal(3);
                a.set(-5);
                setTimeout(function () {
                    res.should.equal(-3);
                    a.set(123);
                    b.set(321);
                    res.should.equal(-3); // not changed
                    setTimeout(function () {
                        res.should.equal(444);
                        done();
                    }, 10);
                }, 10);
            });
            it('Hello world!', function () {
                /*
                 {Hello}, {placeholder}{!}
                 /           |         \
                 hi      placeholder    eol
                 /    \
                 (name || default)
                 /  \
                 local  lang
                 */
                var langs = { 'ru': 'мир', 'en': 'world' };
                var local = new rdot_1["default"]('en', { sync: true });
                var name = new rdot_1["default"]('', { sync: true });
                var hi = new rdot_1["default"]('Hello', { sync: true });
                var def = new rdot_1["default"](function () { return langs[local.get()]; }, { sync: true });
                var eol = new rdot_1["default"]('!', { sync: true });
                var placeholder = new rdot_1["default"](function () { return name.get() || def.get(); }, { sync: true });
                var msg = new rdot_1["default"](function () { return hi + ', ' + placeholder + eol; }, { sync: true });
                var res = 'fail';
                msg.onValue(function (x) { return res = x; });
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
        describe('unlinking', function () {
            // 1. a => b + c --> c (1)
            // 2. a => (b => c) + c --> c (2)
            // 3. a => b + c --> c (1)
            var c = new rdot_1["default"](3, { sync: true });
            var b = new rdot_1["default"](1, { sync: true });
            var a = new rdot_1["default"](function () { return b.get() + c.get(); }, { sync: true });
            var res;
            a.onValue(function (x) { return res = x; });
            it('b + *a, c + *a', function () {
                res.should.equal(4);
                c.linked.length.should.equal(1);
            });
            it('c + *b', function () {
                b.set(function () { return +c; });
                res.should.equal(6);
                c.linked.length.should.equal(2);
            });
            it('c - *b', function () {
                b.set(5);
                res.should.equal(8);
                c.linked.length.should.equal(1);
            });
            it('b - *a, c - *a', function () {
                a.set(-1);
                res.should.equal(-1);
                c.linked.length.should.equal(0);
                c.linked.length.should.equal(0);
            });
        });
        describe('dom', function () {
            it('input', function (done) {
                var el = document.createElement('input');
                el.value = 'foo';
                var val = rdot_1["default"].dom(el);
                val.get().should.equal('foo');
                val.set('bar');
                setTimeout(function () {
                    el.value.should.equal('bar');
                    done();
                }, 10);
            });
        });
    });
});
