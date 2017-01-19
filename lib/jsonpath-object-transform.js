/*jshint evil:true*/
/*global module, require, define*/

(function (root, factory) {
  'use strict';


  if (typeof Object.assign != 'function') {
    Object.assign = function(target) {
      if (target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      target = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== null) {
          for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
              target[key] = source[key];
            }
          }
        }
      }
      return target;
    };
  }

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
  var evaluate = require('static-eval');

  jsonPath.JSONPath.Handlers.prototype._fns['member-child-script_expression'] = function(component,partial) {
    var src = component.expression.value.slice(1,-1);
    var ast = aesprim.parse(src).body[0].expression;
    var target_env = Object.assign({},jsonPath.env || {}, {'@' : partial.value });
    var res = {path: partial.path.concat([0, component.expression.value ]), value: evaluate(ast, target_env) };
    return res;
  };

  jsonPath.JSONPath.Handlers.prototype._fns['subscript-descendant-script_expression'] = function(component,partial) {
    var src = component.expression.value.slice(1,-1);
    var ast = aesprim.parse(src).body[0].expression;

    if (Array.isArray(partial.value)) {
      var result = partial.value.map(function(val,idx) {
        var target_env = Object.assign({},jsonPath.env || {}, {'@' : val });
        var res = {path: partial.path.concat([idx, component.expression.value ]), value: evaluate(ast, target_env) };
        return res;
      });
      return result;
    }
    var target_env = Object.assign({},jsonPath.env || {}, {'@' : partial.value });
    var value = evaluate(ast, target_env);
    if ( ! value ) {
      console.log('Warning, traversing on selector not implemented');
      return [];
    }
    var path = '$[{{value}}]'.replace(/\{\{\s*value\s*\}\}/g, value);
    var results = jsonPath.nodes(partial.value, path);
    results.forEach(function(r) {
      r.path = partial.path.concat(r.path.slice(1));
    });

    return results;
  };

  jsonPath.JSONPath.Handlers.prototype._fns['subscript-child-script_expression'] = function(component, partial) {
    var exp = component.expression.value.slice(1,-1);

    var jp = jsonPath;
    var ast = aesprim.parse(exp).body[0].expression;
    if (Array.isArray(partial.value)) {
      var mapped = partial.value.map(function(val,idx) {
        var target_env = Object.assign({},jsonPath.env || {}, {'@' : val });
        var res = {path: partial.path.concat([idx, component.expression.value ]), value: evaluate(ast, target_env) };
        return res;
      });
      return mapped;
    }

    console.log('This selector is deprecated, move to using direct access');

    var target_env = Object.assign({},jsonPath.env || {}, {'@' : partial.value });
    var value = evaluate(ast, target_env);
    var path = '$[{{value}}]'.replace(/\{\{\s*value\s*\}\}/g, value);
    var results = jp.nodes(partial.value, path);
    results.forEach(function(r) {
      r.path = partial.path.concat(r.path.slice(1));
    });

    return results;
  };

  jsonPath.fixRules = function() {
    jsonPath.JSONPath.Parser.grammar.lex.rules.forEach(function(ruleset,idx) {
      if (ruleset[1].indexOf('SCRIPT_EXPRESSION') >= 0) {
        ruleset[0] = '(?:[^\?]|^)\\(.+?\\)(?=(\\]|$))';
        if (jsonPath.parser.lexer) {
          jsonPath.parser.lexer.rules[idx] = new RegExp(ruleset[0]);
        }
        if (jsonPath.parser.yy.lexer) {
          jsonPath.parser.yy.lexer.rules[idx] = new RegExp(ruleset[0]);
        }
      }
    });
  };

  jsonPath.fixRules();

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
    if (key.indexOf('.*') >= 0 && seek.length > 0) {
      key = key.replace('.*','');
      Object.keys(seek[0]).filter(function(outkey) { return (outkey.indexOf(key) === 0); } ).forEach(function(outkey) {
        result[outkey] = seek[0][outkey];
      });
      return;
    }
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
    var original_result = result;
    var subpath = pathArr[1];
    var path = pathArr[0];
    if ( ! path ) {
      result[key] = pathArr;
      return;
    }
    if (path.indexOf('$') !== 0 && path.indexOf('@') !== 0) {
      if (Array.isArray(path)) {
        result[key] = [];
        seekArray(data,path,result[key],0);
        return;
      }
      result[key] = pathArr;
      return;
    }

    var seek = jsonPath.query(data, path) || [];

    if ( ! seek[0].forEach ) {
      seek[0] = [ seek[0] ];
    }
    if (seek.length && subpath) {
      result = result[key] = [];
      seek[0].forEach(function(item, index) {
        walk(item, subpath, result, index);
      });
      if (subpath.ARRAY === 'collapse') {
        original_result[key] = result[0];
      }
      if (subpath.ARRAY) {
        result.forEach(function(obj,idx) {
          delete obj.ARRAY;
          var res = [];
          Object.keys(obj).forEach(function(idx) {
            res[parseInt(idx)] = obj[idx];
          });
          result[idx] = res;
        });
      }
      while(result.indexOf(null) >= 0) {
        result.splice(result.indexOf(null),1);
      }
      while(result.indexOf(undefined) >= 0) {
        result.splice(result.indexOf(undefined),1);
      }

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
    var inresult = result;
    if (typeof key !== 'undefined') {
      if ((key+'').indexOf('$') >= 0) {
        return iterateKeysObject(data,pathObj,result,key);
      }
      result = result[key] = {};
    }
    Object.keys(pathObj).forEach(function(name) {
      walk(data, pathObj[name], result, name);
    });
    if (pathObj.ARRAY) {
      var res = [];
      Object.keys(result).forEach(function(idx) {
        if (idx === 'ARRAY') {
          return;
        }
        res[parseInt(idx)] = result[idx];
      });
      inresult[key] = res;
    }
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
