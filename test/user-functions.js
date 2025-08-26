import { expect } from 'vitest'
import transform from '..'

const cities = [
  { foo: 'bar', name: 'London', population: 8615246 },
  { fod: 'baz', name: 'Berlin', population: 3517424 },
  { fod: 'bar', name: 'Outer London', population: 'Me' },
  { name: 'Madrid', population: 3165235 },
  { name: 'Rome', population: 2870528 }
]

const values = [1, 2, 3, 4]

const environ = {
  toupper: function (x) {
    return x.toUpperCase()
  },
  wrap_int: function (x) {
    return { val: 2 * x }
  }
}

describe('User functions', function () {
  it('can run a custom function on the data', function () {
    const result = transform(cities, { value: ['$[(toupper(@.name))]'] }, environ)
    expect(result.value).have.members(
      cities.map(function (x) {
        return x.name.toUpperCase()
      })
    )
  })
  it('can run a custom function on the data, looping over results', function () {
    const result = transform(values, { value: ['$[*].(wrap_int(@))', { foo: '@.val' }] }, environ)
    expect(
      result.value.map(function (x) {
        return x.foo
      })
    ).have.members([2, 4, 6, 8])
  })
  it('can fill an array', function () {
    const result = transform(values, { value: ['$', { foo: '@' }] }, environ)
    expect(
      result.value.map(function (x) {
        return x.foo
      })
    ).have.members([1, 2, 3, 4])
  })

  it('supports env functions inside array subtemplates', function () {
    const result = transform(values, { out: ['$[*].(wrap_int(@))', { up: '@.val' }] }, environ)
    expect(
      result.out.map(function (x) {
        return x.up
      })
    ).to.deep.equal([2, 4, 6, 8])
  })

  it('supports collapse after mapping via env function', function () {
    const result = transform(values, { first: ['$[*].(wrap_int(@))', { up: '@.val', ARRAY: 'collapse' }] }, environ)
    expect(result.first).to.deep.equal({ up: 2 })
  })
})
