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

var environ = {
  'toupper' : function(x) { return x.toUpperCase(); }
};

describe('User functions', function() {
  it('can run a custom function on the data',function(){
    var result = transform(cities, { 'value': [ '$[(toupper(@.name))]' ] }, environ );
    expect(result.value).have.members( cities.map(function(x) {  return x.name.toUpperCase(); }));
  });
});