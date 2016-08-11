var StreamTransform = require('.').Stream;
var JSONStream = require('JSONStream');
var fs = require('fs');

var stream_transform_array = function(stream,template) {
	var selector = convert_selector(template[0]);
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

// stream_transform(fs.createReadStream('test.json'),['$', { 'new' : '@.bar' }]).on('data',function(dat) {
// 	console.log("Simple lookup" ,dat);
// });

// stream_transform(fs.createReadStream('test.json'),['$', { 'new' : '$[(toupper(@,@.bar))]' }]).on('data',function(dat) {
// 	console.log("Function lookup", dat);
// });

// stream_transform(fs.createReadStream('test.json'),{ '$[*].new' : { 'new' : '$.(toupper(@.bar))' } });
// stream_transform(fs.createReadStream('test.json'),{ '$[*].new' : { 'new' : '$.(@.bar || @.baz)' } });
// stream_transform(fs.createReadStream('test.json'),{ '$[*].bara' : { 'bara' : '@.bar', 'baza' : '@.baz', 'static' : {'sub' : 'value' }}, '$[*].baza' : { 'bara2' : '@.bar', 'baza' : '@.baz' } });

// fs.createReadStream('test.json').pipe(StreamTransform(['$', { 'new' : '@.bar' }])).on('data',function(dat) {
//   console.log(dat);
// });

fs.createReadStream('test.json').pipe(JSONStream.parse('*')).pipe(StreamTransform(['$[?(@.bar)]', { 'new' : '@.bar' }])).on('data',function(dat) {
  console.log("Output ",dat);
});

fs.createReadStream('test.json').pipe(JSONStream.parse('*')).pipe(StreamTransform({ '$[?(@.bar)].new' : { 'new' : '$.(@.bar || @.baz)', 'type' : 'this' }, '$[?(@.baz)].new' : { 'new' : '$.(@.bar || @.baz)', 'type' : 'other' }  })).on('data',function(dat) {
  console.log("Collected ",dat);
});


// console.log(jp.parse('$foo'))
// console.log(jp.parse('$foo'))
