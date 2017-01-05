var util = require('util');
var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;
var JSONStream = require('JSONStream');
var unpipe = require('unpipe');
var sort = require('./sort');

var jp = require('jsonpath');

/* Streaming transform of JSON objects using the given template
   calling functions from the given environment if necessary
 */
function ObjectTransform(template,functions,options) {
  // allow use without new
  if (!(this instanceof ObjectTransform)) {
    return new ObjectTransform(template,functions,options);
  }
  if ( ! options ) {
    options = {};
  }
  this.template = template;
  this.functions = functions || {};
  options.objectMode = true;
  Transform.call(this, options);
}
util.inherits(ObjectTransform, Transform);

ObjectTransform.prototype._transform = function (obj, enc, cb) {
  var transformer = require('..');
  this.push(transformer(obj,this.template, this.functions));
  cb();
};

/* We want to select a key based upon a JSON
   selector on the given data.
 */
function KeyExtractor(selector,options) {
  // allow use without new
  if (!(this instanceof KeyExtractor)) {
    return new KeyExtractor(selector,options);
  }
  if ( ! options ) {
    options = {};
  }
  this.selector = selector;
  options.objectMode = true;
  Transform.call(this, options);
}
util.inherits(KeyExtractor, Transform);

KeyExtractor.prototype._transform = function (obj, enc, cb) {
  var self = this;
  if (this.selector) {
    var keyval = jp.query(obj,'$.'+this.selector)[0];
    obj.KEY = keyval;
  }
  if (obj.KEY) {
    var keys = obj.KEY.toString().split(/[,;\s]+/);
    if (keys.length > 1) {
      keys.forEach(function(key) {
        var obj_copy = JSON.parse(JSON.stringify(obj));
        obj_copy.KEY = key;
        self.push(obj_copy);
      });
    } else {
      this.push(obj);
    }
  }
  cb();
};

function JSONFilter(selector,options) {
  // allow use without new
  if (!(this instanceof JSONFilter)) {
    return new JSONFilter(selector,options);
  }
  if ( ! options ) {
    options = {};
  }
  this.selector = selector;
  options.objectMode = true;
  Transform.call(this, options);
}
util.inherits(JSONFilter, Transform);

JSONFilter.prototype._transform = function (obj, enc, cb) {
  var keyval = true;
  if (this.selector) {
    keyval = jp.query([obj],'$['+this.selector+']')[0];
    if (keyval) {
      this.push(obj);
    }
  } else {
    this.push(obj);
  }
  cb();
};

function ContextWriter(template,key,isArray,env,options) {
  // allow use without new
  if (!(this instanceof ContextWriter)) {
    return new ContextWriter(template,key,isArray,env,options);
  }
  if ( ! env ) {
    env = {};
  }
  if ( ! options ) {
    options = {};
  }
  this.template = template;
  this.env = env;
  this.key = key;
  this.isArray = isArray || false;
  options.objectMode = true;
  Transform.call(this, options);
  if (key) {
    if (! isArray) {
      this.push('{\n"'+key+'" : {\n');
    } else {
      this.push('{\n"'+key+'" : [\n');
    }
  }
}
util.inherits(ContextWriter, Transform);

ContextWriter.prototype._transform = function (obj, enc, cb) {
  if (this.key) {
    if ( ! Array.isArray(obj) ) {
      this.push((this.written ? ',\n' : '')+JSON.stringify(obj));
    } else {
      this.push((this.written ? ',\n' : '') +'\t"'+obj[0]+'":'+obj[1]);
    }
    this.written = true;
  } else {
    this.push(obj);
  }
  cb();
};

ContextWriter.prototype._flush = function (cb) {
  if (this.key) {
    var self = this;
    var used_key = this.key;
    var template = this.template;
    var remaining_keys = Object.keys(template).filter(function(key) {
      return key !== used_key;
    });
    this.push('\n' + (this.isArray ? ']' : '}') + (remaining_keys.length > 0 ? ',' : '') +  '\n');
    var transformer = require('..');
    remaining_keys.forEach(function(key,idx) {
      var transformed_context = transformer({},template[key], self.env);
      self.push('\t"'+key+'":'+JSON.stringify(transformed_context)+( idx < (remaining_keys.length - 1) ? ',' : '' )+'\n');
    });
    this.push('}\n');
  }
  cb();
};


function Collector(options) {
  if (!(this instanceof Collector)) {
    return new Collector(options);
  }

  if (!options) {
    options = {};
  }
  options.objectMode = true;
  Transform.call(this, options);
  this.collected = [];
}

util.inherits(Collector, Transform);

Collector.prototype._transform = function (obj,enc,cb) {
  if (this.lastid !== null && this.lastid !== obj.KEY) {
    if (this.collected.length > 0) {
      this.push([this.lastid,JSON.stringify([].concat(this.collected))]);
    }
    this.collected = [];
  }
  this.collected.push(obj);
  this.lastid = obj.KEY;
  delete obj.KEY;
  cb();
};

Collector.prototype._flush = function(cb) {
  if (this.collected.length > 0) {
    this.push([this.lastid,JSON.stringify([].concat(this.collected))]);
  }
  cb();
};

var convert_selector = function(selector) {
  var syntax = jp.parse(selector);
  if ( syntax[0].expression.type !== 'root') {
    console.log('Not a selector');
    return;
  }
  // Remove root
  syntax.splice(0,1);
  if (syntax.length < 1) {
    return { path : '*', key:null };
  }
  var subscript_index = syntax.map(function (part) {return part.operation; }).indexOf('subscript');
  var key = null;
  var filter = null;
  var key_part = subscript_index >= 0 ? syntax.splice(subscript_index,(syntax.length - subscript_index)) : [];

  if (key_part.length > 0 && key_part[0].operation === 'subscript' && key_part[0].expression.type === 'filter_expression') {
    filter = key_part[0].expression.value;
    if (filter === '*') {
      filter = null;
    }
  }

  if (key_part.length > 0 && key_part[0].operation === 'subscript' && key_part[0].expression.type === 'script_expression') {
    key = key_part[0].expression.value;
    if (key === '*') {
      key = null;
    }
  } else if (key_part.length > 1) {
    key_part.splice(0,1);
    key = '(@.'+key_part.map(function (part) { return part.expression.value; }).join('.')+')';
  }

  var path = syntax.map( function(part) { return part.expression.value; }).join('.');
  return {'path' : (path ? path+'.*' : '*') , 'key' : key, 'filter' : filter };
};


var stream_transform_array = function(stream,template,env) {
  var selector = convert_selector(template[0]);
  return stream.pipe(JSONStream.parse(selector.path)).pipe(new ObjectTransform(template[1],env));
};

var stream_transform_object_array = function(stream,template,env) {
  var selector = convert_selector(template[0]);
  return stream.pipe(new JSONFilter(selector.filter)).pipe(new ObjectTransform(template[1],env));
};


var stream_transform_collect = function(stream,template,env) {
  var selectors = Object.keys(template);
  var output = new PassThrough({objectMode : true});
  selectors.forEach(function(selector_string) {
    var selector = convert_selector(selector_string);
    return stream
       .pipe(JSONStream.parse(selector.path))
       .pipe(new JSONFilter(selector.filter))
       .pipe(new ObjectTransform(template[selector_string],env))
       .pipe(new KeyExtractor(selector.key))
       .pipe(output);
  });
  return output.pipe(sort()).pipe(new Collector());
};

var stream_transform_object_collect = function(stream, template,env) {
  var selectors = Object.keys(template);
  var output = new PassThrough({objectMode : true});
  var any_selector = false;
  selectors.forEach(function(selector_string) {
    var selector = convert_selector(selector_string);
    if ( ! selector ) {
      return;
    }
    any_selector = true;
    stream
    .pipe(new JSONFilter(selector.filter))
    .pipe(new ObjectTransform(template[selector_string],env))
    .pipe(new KeyExtractor(selector.key))
    .pipe(output);
  });
  if (! any_selector) {
    output.end();
  }
  return output.pipe(sort()).pipe(new Collector());
};


var stream_transform = function(stream, template,env) {
  if (Array.isArray(template)) {
    return stream_transform_array(stream,template,env);
  }
  return stream_transform_collect(stream,template,env);
};

var stream_transform_object = function(stream,template,env) {
  if (Array.isArray(template)) {
    return stream_transform_object_array(stream,template,env);
  }
  return stream_transform_object_collect(stream,template,env);
};

// Transform an object stream
module.exports = function(template,key,env) {
  var input_stream = new PassThrough({objectMode: true});
  input_stream.on('pipe',function(src) {

    if (src.transformed) {
      return;
    }

    var transformed_stream = null;
    if ( ! src._readableState || src._readableState.objectMode ) {
      if ( src.unpipe ) {
        src.unpipe(input_stream);
      } else {
        unpipe(src);
      }
      if (key) {
        input_stream._readableState.objectMode = false;
      }
      transformed_stream = stream_transform_object(src,key ? template[key] : template,env).pipe(new ContextWriter(template,key,Array.isArray( key ? template[key] : template ),env));
    } else {
      src.unpipe(input_stream);
      if (key) {
        input_stream._readableState.objectMode = false;
      }
      transformed_stream = stream_transform(src,key ? template[key] : template,env).pipe(new ContextWriter(template,key,Array.isArray( key ? template[key] : template ),env));
    }
    transformed_stream.transformed = true;
    transformed_stream.pipe(input_stream);
  });
  return input_stream;
};


