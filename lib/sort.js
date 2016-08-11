var util = require('util'),
    spawn = require('child_process').spawn;

var Transform = require('stream').Transform;

var JSONStream = require('JSONStream');
var PassThrough = require('stream').PassThrough;

function KeyWriter(options) {
  // allow use without new
  if (!(this instanceof KeyWriter)) {
    return new KeyWriter(options);
  }
  if ( ! options ) {
    options = {};
  }
  options.objectMode = true;
  Transform.call(this, options);
}
util.inherits(KeyWriter, Transform);

KeyWriter.prototype._transform = function (obj, enc, cb) {
  var output = [obj.KEY,JSON.stringify(obj)].join('\t')+',\n';
  this.push(output);
  cb();
};

var Sorter = function() {
  var input = new PassThrough({objectMode: true});
  var sort = spawn('sort', ['-k','1,1','-t','\t','-']);
  var cut = spawn('cut', ['-d','\t','-f','2']);
  input.pipe(new KeyWriter()).pipe(sort.stdin);
  sort.stdout.pipe(cut.stdin);
  this.stream = JSONStream.parse('*');
  this.stream.write('[\n');
  cut.stdout.pipe(this.stream);
  this.input = input;
  return this;
};

var make_sort_stream = function() {
  var input = new PassThrough({objectMode: true});
  input.on('pipe',function(src) {
    if (src.sorted) {
      return;
    }
    src.unpipe(input);
    var sorter = Sorter();
    src.pipe(sorter.input);
    sorter.stream.sorted = true;
    sorter.stream.pipe(input);
  });
  return input;
};

module.exports = make_sort_stream;