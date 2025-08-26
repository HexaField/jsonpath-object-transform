import { spawn } from 'child_process';
import { Transform, PassThrough, TransformCallback } from 'stream';
import JSONStream from 'JSONStream';

class KeyWriter extends Transform {
  constructor(options?: any) {
    super({ ...(options || {}), objectMode: true });
  }
  _transform(obj: any, _enc: BufferEncoding, cb: TransformCallback) {
    const output = [obj.KEY, JSON.stringify(obj)].join('\t') + ',\n';
    this.push(output);
    cb();
  }
}

const Sorter = function() {
  const input = new PassThrough({ objectMode: true });
  const sortProc = spawn('sort', ['-k', '1,1', '-t', '\t', '-']);
  const cutProc = spawn('cut', ['-d', '\t', '-f', '2']);
  input.pipe(new KeyWriter()).pipe(sortProc.stdin);
  sortProc.stdout.pipe(cutProc.stdin);
  const stream: any = JSONStream.parse('*');
  stream.write('[\n');
  cutProc.stdout.pipe(stream);
  return { input, stream };
};

export default function make_sort_stream() {
  const input = new PassThrough({ objectMode: true });
  input.on('pipe', function(src: any) {
    if (src.sorted) { return; }
    src.unpipe(input);
    const sorter = Sorter();
    src.pipe(sorter.input);
    sorter.stream.sorted = true;
    sorter.stream.pipe(input);
  });
  return input;
}
