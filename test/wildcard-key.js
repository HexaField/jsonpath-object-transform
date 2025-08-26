import { expect } from 'vitest'
import transform from '..'

const cities = {
  cities: [
    { foo: 'bar', name: 'London', population: 8615246, optional: true },
    { fod: 'baz', name: 'Berlin', population: 3517424 },
    { fod: 'bar', name: 'Outer London', population: 1 },
    { name: 'Madrid', population: 3165235 },
    { name: 'Rome', population: 2870528 }
  ]
}

const half_popn = function (result, data) {
  result['half_popn'] = {}
  result['half_popn']['pop.50'] = data.map(function (val) {
    return val.population / 2
  })
  result['half_popn']['pop.25'] = data.map(function (val) {
    return val.population / 4
  })
  return "'half_popn'"
}

const half_popn_direct = function (data) {
  const result = {}
  result['pop.50'] = data.map(function (val) {
    return val.population / 2
  })
  result['pop.25'] = data.map(function (val) {
    return val.population / 4
  })
  return result
}

describe('Wildcard mapping of values', function () {
  it('Accepts values from a wildcard result from a function', function () {
    const result = transform(cities, { 'pop.*': '$[(half_popn( @, @.cities ))]' }, { half_popn: half_popn })
    expect(result).have.keys(['pop.25', 'pop.50'])
    expect(result['pop.50']).have.members(
      cities.cities.map(function (val) {
        return val.population / 2
      })
    )
    expect(result['pop.25']).have.members(
      cities.cities.map(function (val) {
        return val.population / 4
      })
    )
    expect(result).not.have.keys(['pop.*', 'half_popn'])
  })
  it('Accepts values from a wildcard result from a function using direct syntax', function () {
    const result = transform(cities, { 'pop.*': '$.(half_popn( @.cities ))' }, { half_popn: half_popn_direct })
    expect(result).have.keys(['pop.25', 'pop.50'])
    expect(result['pop.50']).have.members(
      cities.cities.map(function (val) {
        return val.population / 2
      })
    )
    expect(result['pop.25']).have.members(
      cities.cities.map(function (val) {
        return val.population / 4
      })
    )
    expect(result).not.have.keys(['pop.*', 'half_popn'])
  })

  it('Expands wildcard destination keys when source path is $', function () {
    const data = { 'pre.one': 1, 'pre.two': 2, other: 3 }
    const res = transform(data, { 'pre.*': '$' })
    expect(res).to.have.keys(['pre.one', 'pre.two'])
    expect(res).to.not.have.property('other')
  })

  it('Expands wildcard destination keys when source path is @', function () {
    const data = { 'pre.x': 'x', 'pre.y': 'y', z: 'z' }
    const res = transform(data, { 'pre.*': '@' })
    expect(res).to.have.keys(['pre.x', 'pre.y'])
  })
})
