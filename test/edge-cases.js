var transform = require('..');
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

describe('Edge cases and expected behaviors', function() {
  describe('Single value selection behaviors', function() {
    it('returns the first match when JSONPath yields multiple results', function() {
      var data = { a: [{ name: 'first' }, { name: 'second' }] };
      var tpl = { first: '$.a[*].name' };
      var res = transform(data, tpl);
      assert.propertyVal(res, 'first', 'first');
    });

    it('treats non-$/@ strings as literals', function() {
      var data = { };
      var tpl = { msg: 'hello', looksLikePath: '[1,2,3]' };
      var res = transform(data, tpl);
      assert.deepEqual(res, { msg: 'hello', looksLikePath: '[1,2,3]' });
    });

    it('supports top-level @ and $ to return the full input object', function() {
      var data = { x: 1, y: { z: true } };
      var tpl = { self: '@', root: '$' };
      var res = transform(data, tpl);
      assert.deepEqual(res.self, data);
      assert.deepEqual(res.root, data);
    });
  });

  describe('Array selection and cleanup', function() {
    it('compacts arrays by removing null/undefined items', function() {
      var data = [ { v: 1 }, { }, { v: 3 } ];
      var tpl = { vals: ['$', { out: '$.v' }] };
      var res = transform(data, tpl);
      // Expect entries without v to be dropped from array
      expect(res.vals.map(function(x){ return x && x.out; })).to.deep.equal([1,3]);
      expect(res.vals.length).to.equal(2);
    });

    it('preserves literal arrays when path does not start with $ or @', function() {
      var data = {};
      var tpl = { arr: ['a', 'b', 'c'] };
      var res = transform(data, tpl);
      expect(res.arr).to.deep.equal(['a','b','c']);
    });
  });

  describe('Context (@) shorthand in subtemplates', function() {
    it('accepts @name as shorthand for @.name inside subtemplate context', function() {
      var data = [{ name: 'A' }, { name: 'B' }];
      var tpl = { names: ['$', { val: '@name' }] };
      var res = transform(data, tpl);
      expect(res.names.map(function(x){ return x.val; })).to.deep.equal(['A','B']);
    });
  });

  describe('Grouping by dynamic keys', function() {
    it('splits multi-key strings into multiple groups', function() {
      var data = [
        { name: 'one', tags: 'a,b c' },
        { name: 'two', tags: 'a' },
        { name: 'three' } // no tags
      ];
      var tpl = { '$[*].tags': { name: '@name' } };
      var res = transform(data, tpl);
      expect(res).to.have.keys(['a','b','c']);
      expect(res.a.map(function(x){ return x.name; })).to.have.members(['one','two']);
      expect(res.b.map(function(x){ return x.name; })).to.have.members(['one']);
      expect(res.c.map(function(x){ return x.name; })).to.have.members(['one']);
    });
  });

  describe('Wildcard destination key with prefix copying', function() {
    it('copies matched keys with the given prefix from the source object', function() {
      var data = { 'pref.one': 1, 'pref.two': 2, other: 3 };
      var tpl = { 'pref.*': '$' };
      var res = transform(data, tpl);
      expect(res).to.have.keys(['pref.one','pref.two']);
      assert.equal(res['pref.one'], 1);
      assert.equal(res['pref.two'], 2);
      expect(res).to.not.have.property('other');
    });
  });

  describe('ARRAY helper flags', function() {
    it('collapses a subtemplate array when ARRAY === "collapse"', function() {
      var data = { items: [ { x: 1 }, { x: 2 } ] };
      var tpl = { first: ['$.items[*]', { val: '$.x', ARRAY: 'collapse' }] };
      var res = transform(data, tpl);
      expect(res.first).to.deep.equal({ val: 1 });
    });

    it('converts numeric-keyed objects into arrays when ARRAY is truthy', function() {
      var data = { items: [ { a: 'A', b: 'B' } ] };
      // Build a numeric-keyed object in subtemplate to trigger ARRAY coercion
      var tpl = { out: ['$.items[*]', { '0': '$.a', '1': '$.b', ARRAY: true }] };
      var res = transform(data, tpl);
      // Expect out to be [ ['A','B'] ]
      expect(res.out).to.deep.equal([ ['A','B'] ]);
    });
  });
});
