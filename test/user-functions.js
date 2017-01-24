var transform = require('..');
var chai = require('chai');
var expect = chai.expect;
var assert = chai.assert;

var cities = [
  { foo: 'bar', name: "London", "population": 8615246 },
  { fod: 'baz', name: "Berlin", "population": 3517424 },
  { fod: 'bar', name: "Outer London", "population" : "Me"},
  { name: "Madrid", "population": 3165235 },
  { name: "Rome",   "population": 2870528 }
];

var values = [ 1, 2, 3, 4];

var environ = {
  'toupper' : function(x) { return x.toUpperCase(); },
  'wrap_int' : function(x) { return { val : 2*x }}
};

describe('User functions', function() {
  it('can run a custom function on the data',function(){
    var result = transform(cities, { 'value': [ '$[(toupper(@.name))]' ] }, environ );
    expect(result.value).have.members( cities.map(function(x) {  return x.name.toUpperCase(); }));
  });
  it('can run a custom function on the data, looping over results',function(){
    var result = transform(values, { 'value': [ '$[*].(wrap_int(@))', { 'foo' : '$.val' } ] }, environ );
    expect(result.value.map(function(x) { return x.foo; })).have.members( [2,4,6,8] );
  });
  it('can fill an array',function(){
    var result = transform(values, { 'value': [ '$', { 'foo' : '$' } ] }, environ );
    expect(result.value.map(function(x) { return x.foo; })).have.members( [ 1,2,3,4 ] );
  });

});