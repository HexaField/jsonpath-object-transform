import { assert, expect } from 'vitest'
import transform from '..'

const cities = [
  { foo: 'bar', name: 'London', population: 8615246 },
  { fod: 'baz', name: 'Berlin', population: 3517424 },
  { fod: 'bar', name: 'Outer London', population: 'Me' },
  { name: 'Madrid', population: 3165235 },
  { name: 'Rome', population: 2870528 }
]

describe('Nesting', function () {
  it('allows for static nesting', function () {
    const result = transform(cities, { data: { '$..[(@.foo || @.fod)]': { name: '@name' } } })
    expect(result).have.keys(['data'])
    expect(result.data).have.keys(['bar', 'baz'])
    assert.equal(result.data.bar.length, 2)
    assert.equal(result.data.baz.length, 1)
  })
  it('allows for static nesting', function () {
    const result = transform(cities, {
      data: { '$..[(@.foo || @.fod)]': { name: '@name' } },
      metadata: { this: 'that' }
    })
    expect(result).have.keys(['data', 'metadata'])
    expect(result.metadata).have.keys(['this'])
  })
  it('allows for static nesting of arrays', function () {
    const result = transform(cities, {
      data: { '$..[(@.foo || @.fod)]': { name: '@name' } },
      metadata: { this: ['*.that', '*.think'] }
    })
    expect(result).have.keys(['data', 'metadata'])
    assert.equal(result.metadata.this.length, 2)
  })

  it('supports nested array subtemplates with collapse', function () {
    const result = transform(
      { items: [{ a: 1 }, { a: 2 }] },
      {
        nested: {
          first: ['$.items[*]', { v: '$.a', ARRAY: 'collapse' }]
        }
      }
    )
    expect(result.nested.first).to.deep.equal({ v: 1 })
  })

  it('supports nested grouping plus arrays', function () {
    const data = [
      { t: 'x', v: 1 },
      { t: 'y', v: 2 },
      { t: 'x', v: 3 }
    ]
    const tpl = { data: { '$[*].t': { values: ['$', { n: '@v' }] } } }
    const res = transform(data, tpl)
    const xVals = [].concat.apply(
      [],
      res.data.x.map(function (o) {
        return o.values.map(function (x) {
          return x.n
        })
      })
    )
    const yVals = [].concat.apply(
      [],
      res.data.y.map(function (o) {
        return o.values.map(function (x) {
          return x.n
        })
      })
    )
    expect(xVals).to.have.members([1, 3])
    expect(yVals).to.have.members([2])
  })
})
