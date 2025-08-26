import { assert, expect } from 'vitest'
import transform from '..'

const cities = [
  { foo: 'bar', name: 'London', population: 8615246 },
  { fod: 'baz', name: 'Berlin', population: 3517424 },
  { fod: 'bar', name: 'Outer London', population: 'Me' },
  { name: 'Madrid', population: 3165235 },
  { name: 'Rome', population: 2870528 }
]

describe('Union mapping', function () {
  it('extracts a key from one of many attributes selected using an or', function () {
    const result = transform(cities, { '$[(@.foo || @.fod)]': { name: '@name' } })
    expect(result).have.keys(['bar', 'baz'])
    assert.equal(result.bar.length, 2)
    assert.equal(result.baz.length, 1)
  })
  it('extracts a key from one of many attributes selected using an or', function () {
    const result = transform(cities, { '$[*].foo': { name: '@name' }, '$[*].fod': { name: '@name' } })
    expect(result).have.keys(['bar', 'baz'])
    assert.equal(result.bar.length, 2)
    assert.equal(result.baz.length, 1)
  })

  it('extracts a key from attributes subset using array slice', function () {
    const result = transform(cities, { '$[1,0].name': { name: '@name' } })
    expect(result).have.keys(['Berlin', 'London'])
  })

  it('maps arrays from unioned attribute sets', function () {
    const result = transform(cities, {
      '$[*].foo': { vals: ['$', { n: '@population' }] },
      '$[*].fod': { vals: ['$', { n: '@population' }] }
    })
    expect(result).to.have.keys(['bar', 'baz'])
    const barVals = [].concat.apply(
      [],
      result.bar.map(function (o) {
        return o.vals.map(function (x) {
          return x.n
        })
      })
    )
    const bazVals = [].concat.apply(
      [],
      result.baz.map(function (o) {
        return o.vals.map(function (x) {
          return x.n
        })
      })
    )
    expect(barVals).to.include(8615246)
    expect(bazVals).to.include(3517424)
  })
})
