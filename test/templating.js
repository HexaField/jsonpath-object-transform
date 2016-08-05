var assert = require('chai').assert;
var transform = require('..');

describe('Object templating', function() {
  describe('simple key retrieval', function () {
    it('should retrieve simple values from objects', function () {
      var template = {
        'foo' : '$.bar'
      };
      var data = {
        'bar' : 'baz',
        'bay' : 'bax'
      };
      assert.propertyVal(transform(data,template), 'foo', 'baz');
    });
    it('should handle retrieving the same value twice', function () {
      var template = {
        'foo' : '$.bar',
        'foo2' : '$.bar'
      };
      var data = {
        'bar' : 'baz',
        'bay' : 'bax'
      };
      assert.propertyVal(transform(data,template), 'foo', 'baz');
      assert.propertyVal(transform(data,template), 'foo2', 'baz');
    });
    it('should handle iterating over values', function () {
      var template = {
        '$[*].element' : { 'value': '@foo', 'value2': '@foo2' }
      };
      var data = [
        { 'element' : 'wanted', 'foo' : 'bar', 'foo2': 'baz'},
        { 'foo' : 'bar3', 'foo2': 'baz3'},
        { 'element' : 'wanted', 'foo' : 'bar2', 'foo2': 'baz2'}
      ];
      var res = transform(data,template);
      assert.equal(res.wanted.length,2);
      assert.propertyVal(res.wanted[0], 'value', 'bar');
      assert.propertyVal(res.wanted[1], 'value', 'bar2');
    });
    it('should handle iterating over values on a union', function () {
      var template = {
        '$[*].element' : { 'value': '@foo', 'value2': '@foo2', 'type':'element' },
        '$[*].element2': { 'value': '@foo', 'value2': '@foo2', 'type':'element2'}
      };
      var data = [
        { 'element' : 'wanted', 'foo' : 'bar', 'foo2': 'baz'},
        { 'element2': 'wanted', 'foo' : 'bar3', 'foo2': 'baz3'},
        { 'element' : 'wanted', 'foo' : 'bar2', 'foo2': 'baz2'}
      ];
      var res = transform(data,template);
      assert.equal(res.wanted.length,3);
      assert.propertyVal(res.wanted[0], 'type', 'element');
      assert.propertyVal(res.wanted[1], 'type', 'element');
      assert.propertyVal(res.wanted[2], 'type', 'element2');
    });
  });
});