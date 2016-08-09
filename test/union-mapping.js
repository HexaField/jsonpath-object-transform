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

describe('Union mapping', function() {
  it('extracts a key from one of many attributes selected using an or',function(){
    var result = transform(cities, { '$[(@.foo || @.fod)]' : { 'name' : '@name' } } );
    expect(result).have.keys(['bar','baz']);
    assert.equal(result.bar.length,2);
    assert.equal(result.baz.length,1);
  });
  it('extracts a key from one of many attributes selected using an or',function(){
    var result = transform(cities, { '$[*].foo' : { 'name' : '@name' }, '$[*].fod' : { 'name' : '@name' } } );
    expect(result).have.keys(['bar','baz']);
    assert.equal(result.bar.length,2);
    assert.equal(result.baz.length,1);
  });

  it('extracts a key from attributes subset using array slice',function(){
    var result = transform(cities, { '$[1,0].name' : { 'name' : '@name' } } );
    expect(result).have.keys(['Berlin','London']);
  });

});