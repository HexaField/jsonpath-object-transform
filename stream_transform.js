var JSONStream = require('JSONStream');
var jp = require('jsonpath');

var util = require('util');
var fs = require('fs');
var Transform = require('stream').Transform;

function ObjectTransform(template,options) {
  // allow use without new
  if (!(this instanceof ObjectTransform)) {
    return new ObjectTransform(template,options);
  }
  if ( ! options ) {
  	options = {};
  }
  this.template = template;
  options.objectMode = true;
  // init Transform
  Transform.call(this, options);
}
util.inherits(ObjectTransform, Transform);

ObjectTransform.prototype._transform = function (obj, enc, cb) {
  var transformer = require('.');
  this.push(transformer(obj,this.template, { 'toupper' : function(x) { return x ? x.toUpperCase() : ''; }}));
  cb();
};

function KeyExtractor(template,options) {
  // allow use without new
  if (!(this instanceof KeyExtractor)) {
    return new KeyExtractor(template,options);
  }
  if ( ! options ) {
  	options = {};
  }
  this.template = template;
  options.objectMode = true;
  // init Transform
  Transform.call(this, options);
}
util.inherits(KeyExtractor, Transform);

KeyExtractor.prototype._transform = function (obj, enc, cb) {
  var transformer = require('.');
  if (this.template) {
  	var keyval = jp.query(obj,'$.'+this.template)[0];
	obj.KEY = keyval;//jp.query([obj],'$['+this.template+']', { 'toupper' : function(res,x) { res.UPPER = x.toUpperCase(); return "'UPPER'"; }});  	
  }
  if (obj.KEY) {
	this.push(obj);  	
  }
  cb();
};


var convert_selector = function(selector) {
	var syntax = jp.parse(selector);
	if ( syntax[0].expression.type !== 'root') {
		console.log("Not a selector");
		return;
	}
	// Remove root
	syntax.splice(0,1);
	if (syntax.length < 1) {
		return { path : '*', key:null };
	}
	var subscript_index = syntax.map((part) => part.operation).indexOf('subscript');
	var key_part = subscript_index >= 0 ? syntax.splice(subscript_index,(syntax.length - subscript_index)) : [];
	if (key_part.length > 0 && key_part[0].operation === 'subscript' && key_part[0].expression.type === 'script_expression') {
		var filter = key_part[0].expression.value;
		if (filter === '*') {
			filter = null;
		}
	} else if (key_part.length > 1) {
		key_part.splice(0,1);
		filter = '(@.'+key_part.map((part) => part.expression.value ).join('.')+')';
	}
	var path = syntax.map( function(part) { return part.expression.value; }).join('.');
	return {'path' : (path ? path+".*" : '*') , 'key' : filter };
};

var stream_transform_array = function(stream,template) {
	var selector = convert_selector(template[0]);
	// The selector is not in a JSONPath syntax, so clean up syntax
        console.log(selector);
	return stream.pipe(JSONStream.parse(selector.path)).pipe(new ObjectTransform(template[1]));
};

var stream_transform_collect = function(stream, template) {
	var selectors = Object.keys(template);
	var pipes = selectors.map(function(selector_string) {
		var selector = convert_selector(selector_string);
		console.log(selector);
		return stream
				.pipe(JSONStream.parse(selector.path))
				.pipe(new ObjectTransform(template[selector_string]))
				.pipe(new KeyExtractor(selector.key))
	});
	pipes.forEach((pipe) => pipe.on('data',console.log.bind(console)));
	return pipes[0];
};

var stream_transform = function(stream, template) {
	if (Array.isArray(template)) {
		return stream_transform_array(stream,template);
	}
	return stream_transform_collect(stream,template);
};

// console.log(convert_selector('$.foo')); // = foo
// console.log(convert_selector('$[(@.foo || @.fod)]')) // = * (with function)
// console.log(convert_selector('$.foo[*]')); // = foo
// console.log(convert_selector('foo.*')); // = generated stuff
// console.log(convert_selector('$[(@.id)]')); // = generated stuff
// console.log(convert_selector('$[*].foo')); // = * (with function)

stream_transform(fs.createReadStream('test.json'),['$', { 'new' : '@.bar' }]).on('data',function(dat) {
	console.log("Simple lookup" ,dat);
});

// stream_transform(fs.createReadStream('test.json'),['$', { 'new' : '$[(toupper(@,@.bar))]' }]).on('data',function(dat) {
// 	console.log("Function lookup", dat);
// });

stream_transform(fs.createReadStream('test.json'),{ '$[*].new' : { 'new' : '$.(toupper(@.bar))' } });
stream_transform(fs.createReadStream('test.json'),{ '$[*].new' : { 'new' : '$.(@.bar || @.baz)' } });
stream_transform(fs.createReadStream('test.json'),{ '$[*].bara' : { 'bara' : '@.bar', 'baza' : '@.baz', 'static' : {'sub' : 'value' }}, '$[*].baza' : { 'bara2' : '@.bar', 'baza' : '@.baz' } });

// console.log(jp.parse('$foo'))
// console.log(jp.parse('$foo'))
