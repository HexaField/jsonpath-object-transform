/*jshint evil:true*/
/*global module, require, define*/

(function (root, factory) {
  'use strict';

  // AMD
  if (typeof define === 'function' && define.amd) {
    define('jsonpathObjectTransform', ['jsonpath'], function(jsonPath) {
      return (root.jsonpathObjectTransform = factory(jsonPath));
    });
  }

  // Node
  else if (typeof exports === 'object') {
    module.exports = factory(require('jsonpath'));
  }

  // Browser global
  else {
    root.jsonpathObjectTransform = factory(root.jsonPath);
  }
}(this, function(jsonPath) {
  'use strict';

  var aesprim = require('jsonpath/lib/aesprim');
  var evaluate = require('jsonpath/node_modules/static-eval');
  jsonPath.JSONPath.Handlers.prototype._fns['subscript-descendant-script_expression'] = function(component,partial) {
    var jp = jsonPath;
    var self = this;

    var results = [];
    var nodes = jp.nodes(partial, '$..*').slice(1);

    var src = component.expression.value.slice(1,-1);
    var ast = aesprim.parse(src).body[0].expression;
    return partial.value.map(function(val) {
      return {path: "x", value: evaluate(ast, { '@': val, 'toupper' : function(x) { return x.toUpperCase(); } }) };
    });
  };

  var cities = [ { name: "london" }, {name: "berlin" } ],  jp = require('jsonpath');

  console.log(jsonPath.query(cities,"$..name"));
  console.log(jsonPath.query(cities,"$..[(toupper(@.name,@))]"));

  /**
   * Step through data object and apply path transforms.
   *
   * @param {object} data
   * @param {object} path
   * @param {object} result
   * @param {string} key
   */
  function walk(data, path, result, key) {
    var fn;

    switch (type(path)) {
      case 'string':
        fn = seekSingle;
        break;

      case 'array':
        fn = seekArray;
        break;

      case 'object':
        fn = seekObject;
        break;
    }

    if (fn) {
      fn(data, path, result, key);
    }
  }

  /**
   * Determine type of object.
   *
   * @param {object} obj
   * @returns {string}
   */
  function type(obj) {
    return Array.isArray(obj) ? 'array' : typeof obj;
  }

  /**
   * Get single property from data object.
   *
   * @param {object} data
   * @param {string} pathStr
   * @param {object} result
   * @param {string} key
   */
  function seekSingle(data, pathStr, result, key) {
    var seek = jsonPath.eval(data, pathStr) || [];

    result[key] = seek.length ? seek[0] : undefined;
  }

  /**
   * Get array of properties from data object.
   *
   * @param {object} data
   * @param {array} pathArr
   * @param {object} result
   * @param {string} key
   */
  function seekArray(data, pathArr, result, key) {
    var subpath = pathArr[1];
    var path = pathArr[0];
    var seek = jsonPath.eval(data, path) || [];

    if (seek.length && subpath) {
      result = result[key] = [];

      seek[0].forEach(function(item, index) {
        walk(item, subpath, result, index);
      });
    } else {
      result[key] = seek;
    }
  }

  /**
   * Get object property from data object.
   *
   * @param {object} data
   * @param {object} pathObj
   * @param {object} result
   * @param {string} key
   */
  function seekObject(data, pathObj, result, key) {
    if (typeof key !== 'undefined') {
      result = result[key] = {};
    }

    Object.keys(pathObj).forEach(function(name) {
      walk(data, pathObj[name], result, name);
    });
  }

  /**
   * @module jsonpath-object-transform
   * @param {object} data
   * @param {object} path
   * @returns {object}
   */
  return function(data, path) {
    var result = {};

    walk(data, path, result);

    return result;
  };

}));
