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
    var src = component.expression.value.slice(1,-1);
    var ast = aesprim.parse(src).body[0].expression;
    var result = partial.value.map(function(val,idx) {
      var target_env = Object.assign({},jsonPath.env || {}, {'@' : val });
      return {path: partial.path.concat([idx, component.expression.value ]), value: evaluate(ast, target_env) };
    });
    return result;
  };

  jsonPath.withEnv = function withEnv(env,actions) {
    jsonPath.env = env;
    actions();
    delete jsonPath.env;
  };


  var walk = null;

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
    pathStr = pathStr.replace(/^@\.?/,'$.');
    if ( pathStr.indexOf('$') !== 0) {
      result[key] = pathStr;
      return;
    }
    var seek = jsonPath.query(data, pathStr) || [];
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
    var seek = jsonPath.query(data, path) || [];

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
   * Use a node selector as to identify the keys to translate between
   * an array of values, and an object keyed by the key and containing
   * arrays of values for that given key.
   * @param {object} data
   * @param {array} template Template to use to map values from the values
   * @param {object} result Object to put results in
   * @param {string} searchPath Search path for the keys we wish to map
   */
  function iterateKeysObject(data,template,result,searchPath) {
      // Grab the values for the keys
      // If the key does not match, then the 
      // jpath will return a null value
      // for that key
      var nodes = jsonPath.nodes(data,searchPath);
      var keys = nodes.map( function(node) { return node.value; });

      // Go up 1 level in the heirarchy

      var parent_keys = nodes.filter(function(node) { return node.value !== undefined; }).map( function(node) { return jsonPath.stringify(node.path.slice(0,-1)); });

      // var objects = jsonPath.query(data,objects_key);
      var objects = parent_keys.map(function(key) { return jsonPath.query(data,key)[0]; });
      objects.forEach(function(obj,idx) {
        var object_key = keys[idx];
        // If we get a key match for this returned object
        // We should run the sub-template on this
        if ( ! object_key ) {
          return;
        }

        // As an additional bonus, if the data key looks like
        // it is a list of things (seperated by , ; or space)
        // we should split that list and copy the values into each 
        // entry.
        object_key.split(/[,;\s]+/).forEach(function(split_key) {
          if (! result[split_key] ) {
            result[split_key] = [];
          }
          var res = {};
          walk( obj, template, res );
          result[split_key].push( res );
        });
      });
      return;
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
      if (key.indexOf('$') >= 0) {
        return iterateKeysObject(data,pathObj,result,key);
      }
      result = result[key] = {};
    }

    Object.keys(pathObj).forEach(function(name) {
      walk(data, pathObj[name], result, name);
    });
  }

  /**
   * Step through data object and apply path transforms.
   *
   * @param {object} data
   * @param {object} path
   * @param {object} result
   * @param {string} key
   */
  walk = function walk(data, path, result, key) {
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
  };

  /**
   * @module jsonpath-object-transform
   * @param {object} data
   * @param {object} path
   * @returns {object}
   */
  return function(data, path, env) {
    var result = {};
    if ( ! env ) {
      env = {};
    } else {
      Object.freeze(env);
    }

    jsonPath.withEnv(env, function() {
      walk(data, path, result);
    });

    return result;
  };

}));
