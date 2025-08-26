import { assert } from 'vitest'
import transform from '..'

describe('Object templating', function () {
  describe('numeric static values should copy over', function () {
    it('should copy numeric values in templates directly over', function () {
      assert.propertyVal(transform({}, { foo: 1 }), 'foo', 1)
      assert.propertyVal(transform({}, { foo: '1' }), 'foo', '1')
    })
  })
  describe('simple key retrieval', function () {
    it('should retrieve simple values from objects', function () {
      const template = {
        foo: '$.bar'
      }
      const data = {
        bar: 'baz',
        bay: 'bax'
      }
      assert.propertyVal(transform(data, template), 'foo', 'baz')
    })
    it('should handle retrieving the same value twice', function () {
      const template = {
        foo: '$.bar',
        foo2: '$.bar'
      }
      const data = {
        bar: 'baz',
        bay: 'bax'
      }
      assert.propertyVal(transform(data, template), 'foo', 'baz')
      assert.propertyVal(transform(data, template), 'foo2', 'baz')
    })
    it('should handle iterating over values', function () {
      const template = {
        '$[*].element': { value: '@foo', value2: '@foo2' }
      }
      const data = [
        { element: 'wanted', foo: 'bar', foo2: 'baz' },
        { foo: 'bar3', foo2: 'baz3' },
        { element: 'wanted', foo: 'bar2', foo2: 'baz2' }
      ]
      const res = transform(data, template)
      assert.equal(res.wanted.length, 2)
      assert.propertyVal(res.wanted[0], 'value', 'bar')
      assert.propertyVal(res.wanted[1], 'value', 'bar2')
    })
    it('should handle iterating over values on a union', function () {
      const template = {
        '$[*].element': { value: '@foo', value2: '@foo2', type: 'element' },
        '$[*].element2': { value: '@foo', value2: '@foo2', type: 'element2' }
      }
      const data = [
        { element: 'wanted', foo: 'bar', foo2: 'baz' },
        { element2: 'wanted', foo: 'bar3', foo2: 'baz3' },
        { element: 'wanted', foo: 'bar2', foo2: 'baz2' }
      ]
      const res = transform(data, template)
      assert.equal(res.wanted.length, 3)
      assert.propertyVal(res.wanted[0], 'type', 'element')
      assert.propertyVal(res.wanted[1], 'type', 'element')
      assert.propertyVal(res.wanted[2], 'type', 'element2')
    })

    it('should pull an array of scalar values when array path returns multiple matches', function () {
      const template = {
        list: ['$..example']
      }
      const data = {
        a: { example: 'bar' },
        b: { example: 'baz' }
      }
      const res = transform(data, template)
      assert.deepEqual(res.list.sort(), ['bar', 'baz'])
    })

    it('should drop items in array subtemplate when required field missing', function () {
      const template = {
        out: ['$.items[*]', { value: '$.required' }]
      }
      const data = { items: [{ required: 1 }, {}, { required: 3 }] }
      const res = transform(data, template)
      assert.deepEqual(
        res.out.map(function (x) {
          return x.value
        }),
        [1, 3]
      )
      assert.equal(res.out.length, 2)
    })
  })
})
