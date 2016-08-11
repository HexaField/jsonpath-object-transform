var transform = require('..');
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var cities = [
  { foo: 'bar', name: "London", "population": 8615246, "optional" : true },
  { fod: 'baz', name: "Berlin", "population": 3517424 },
  { fod: 'bar', name: "Outer London", "population" : "Me"},
  { name: "Madrid", "population": 3165235 },
  { name: "Rome",   "population": 2870528 }
];

describe('Value mapping', function() {
  it('maps values on a combiner function using direct selector',function(){
    var result = transform(cities, { '$[(@.foo || @.fod)]' : { 'name' : '@name' } } );
    expect(result.bar.map(function(val) { return val.name })).have.members(['London','Outer London']);
    expect(result.baz.map(function(val) { return val.name })).have.members(['Berlin']);
  });
  it('maps values on a combiner function on a child using direct selector',function(){
    var result = transform({ parent: cities }, { '$.parent[(@.foo || @.fod)]' : { 'name' : '@name' } } );
    expect(result.bar.map(function(val) { return val.name })).have.members(['London','Outer London']);
    expect(result.baz.map(function(val) { return val.name })).have.members(['Berlin']);
  });
  it('maps values on a combiner function on a child using descendant selector',function(){
    var result = transform({ parent: cities }, { '$..[(@.foo || @.fod)]' : { 'name' : '@name' } } );
    expect(Object.keys(result)).not.have.members(['bar','baz']);
  });
  it('maps values on a combiner function using descendant syntax',function(){
    var result = transform(cities, { '$..[(@.foo || @.fod)]' : { 'name' : '@name' } } );
    expect(result.bar.map(function(val) { return val.name })).have.members(['London','Outer London']);
    expect(result.baz.map(function(val) { return val.name })).have.members(['Berlin']);
  });
  it('can include a static value',function(){
    var result = transform(cities, { '$..[(@.foo || @.fod)]' : { 'name' : '@name', 'static' : 'string' } } );
    assert.deepEqual(result.bar.map(function(val) { return val.static; }),['string','string']);
    assert.deepEqual(result.baz.map(function(val) { return val.static; }),['string']);
  });
  it('can include an optional element',function(){
    var result = transform(cities, { '$..[(@.foo || @.fod)]' : { 'name' : '@name', 'option' : '@optional' } } );
    expect(result.bar.map(function(val) { return val.option })).have.members([true,undefined]);
    expect(result.baz.map(function(val) { return val.option })).not.have.members([true]);
  });
});