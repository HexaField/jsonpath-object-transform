import { assert, expect } from 'vitest'
import transform from '..'

describe('Edge cases and expected behaviors', function () {
  describe('Single value selection behaviors', function () {
    it('returns the first match when JSONPath yields multiple results', function () {
      const data = { a: [{ name: 'first' }, { name: 'second' }] }
      const tpl = { first: '$.a[*].name' }
      const res = transform(data, tpl)
      assert.propertyVal(res, 'first', 'first')
    })

    it('treats non-$/@ strings as literals', function () {
      const data = {}
      const tpl = { msg: 'hello', looksLikePath: '[1,2,3]' }
      const res = transform(data, tpl)
      assert.deepEqual(res, { msg: 'hello', looksLikePath: '[1,2,3]' })
    })

    it('supports top-level @ and $ to return the full input object', function () {
      const data = { x: 1, y: { z: true } }
      const tpl = { self: '@', root: '$' }
      const res = transform(data, tpl)
      assert.deepEqual(res.self, data)
      assert.deepEqual(res.root, data)
    })
  })

  describe('Array selection and cleanup', function () {
    it('compacts arrays by removing null/undefined items', function () {
      const data = [{ v: 1 }, {}, { v: 3 }]
      const tpl = { vals: ['$', { out: '$.v' }] }
      const res = transform(data, tpl)
      // Expect entries without v to be dropped from array
      expect(
        res.vals.map(function (x) {
          return x && x.out
        })
      ).to.deep.equal([1, 3])
      expect(res.vals.length).to.equal(2)
    })

    it('preserves literal arrays when path does not start with $ or @', function () {
      const data = {}
      const tpl = { arr: ['a', 'b', 'c'] }
      const res = transform(data, tpl)
      expect(res.arr).to.deep.equal(['a', 'b', 'c'])
    })
  })

  describe('Context (@) shorthand in subtemplates', function () {
    it('accepts @name as shorthand for @.name inside subtemplate context', function () {
      const data = [{ name: 'A' }, { name: 'B' }]
      const tpl = { names: ['$', { val: '@name' }] }
      const res = transform(data, tpl)
      expect(
        res.names.map(function (x) {
          return x.val
        })
      ).to.deep.equal(['A', 'B'])
    })
  })

  describe('Grouping by dynamic keys', function () {
    it('splits multi-key strings into multiple groups', function () {
      const data = [
        { name: 'one', tags: 'a,b c' },
        { name: 'two', tags: 'a' },
        { name: 'three' } // no tags
      ]
      const tpl = { '$[*].tags': { name: '@name' } }
      const res = transform(data, tpl)
      expect(res).to.have.keys(['a', 'b', 'c'])
      expect(
        res.a.map(function (x) {
          return x.name
        })
      ).to.have.members(['one', 'two'])
      expect(
        res.b.map(function (x) {
          return x.name
        })
      ).to.have.members(['one'])
      expect(
        res.c.map(function (x) {
          return x.name
        })
      ).to.have.members(['one'])
    })
  })

  describe('Wildcard destination key with prefix copying', function () {
    it('copies matched keys with the given prefix from the source object', function () {
      const data = { 'pref.one': 1, 'pref.two': 2, other: 3 }
      const tpl = { 'pref.*': '$' }
      const res = transform(data, tpl)
      expect(res).to.have.keys(['pref.one', 'pref.two'])
      assert.equal(res['pref.one'], 1)
      assert.equal(res['pref.two'], 2)
      expect(res).to.not.have.property('other')
    })
  })

  describe('ARRAY helper flags', function () {
    it('collapses a subtemplate array when ARRAY === "collapse"', function () {
      const data = { items: [{ x: 1 }, { x: 2 }] }
      const tpl = { first: ['$.items[*]', { val: '$.x', ARRAY: 'collapse' }] }
      const res = transform(data, tpl)
      expect(res.first).to.deep.equal({ val: 1 })
    })

    it('converts numeric-keyed objects into arrays when ARRAY is truthy', function () {
      const data = { items: [{ a: 'A', b: 'B' }] }
      // Build a numeric-keyed object in subtemplate to trigger ARRAY coercion
      const tpl = { out: ['$.items[*]', { 0: '$.a', 1: '$.b', ARRAY: true }] }
      const res = transform(data, tpl)
      // Expect out to be [ ['A','B'] ]
      expect(res.out).to.deep.equal([['A', 'B']])
    })
  })
})
