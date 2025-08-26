/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transform, PassThrough, TransformCallback } from 'stream';
import JSONStream from 'JSONStream';
import unpipe from 'unpipe';
import sort from './sort';
import { JSONPath } from 'jsonpath-plus';

class ObjectTransform extends Transform {
  private template: any;
  private functions: any;
  constructor(template: any, functions: any, options?: any) {
    super({ ...(options || {}), objectMode: true });
    this.template = template;
    this.functions = functions || {};
  }
  _transform(obj: any, _enc: BufferEncoding, cb: TransformCallback) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const transformer = require('..');
    this.push(transformer(obj, this.template, this.functions));
    cb();
  }
}

class KeyExtractor extends Transform {
  private selector: any;
  constructor(selector: any, options?: any) {
    super({ ...(options || {}), objectMode: true });
    this.selector = selector;
  }
  _transform(obj: any, _enc: BufferEncoding, cb: TransformCallback) {
    const self = this;
    if (this.selector) {
      const keyval = (JSONPath({ path: '$.' + this.selector, json: obj, wrap: true }) as any[])[0];
      obj.KEY = keyval;
    }
    if (obj.KEY) {
      const keys = obj.KEY.toString().split(/[,;\s]+/);
      if (keys.length > 1) {
        keys.forEach(function(key: string) {
          const obj_copy = JSON.parse(JSON.stringify(obj));
          obj_copy.KEY = key;
          (self as any).push(obj_copy);
        });
      } else {
        this.push(obj);
      }
    }
    cb();
  }
}

class JSONFilter extends Transform {
  private selector: any;
  constructor(selector: any, options?: any) {
    super({ ...(options || {}), objectMode: true });
    this.selector = selector;
  }
  _transform(obj: any, _enc: BufferEncoding, cb: TransformCallback) {
    let keyval: any = true;
    if (this.selector) {
      keyval = (JSONPath({ path: '$[' + this.selector + ']', json: [obj], wrap: true }) as any[])[0];
      if (keyval) {
        this.push(obj);
      }
    } else {
      this.push(obj);
    }
    cb();
  }
}

class ContextWriter extends Transform {
  private template: any;
  private env: any;
  private keyStr: string;
  private isArr: boolean;
  private written?: boolean;
  constructor(template: any, key: string, isArray: boolean, env: any, options?: any) {
    super({ ...(options || {}), objectMode: true });
    this.template = template;
    this.env = env || {};
    this.keyStr = key;
    this.isArr = isArray || false;
    if (this.keyStr) {
      if (!this.isArr) { this.push('{\n"' + this.keyStr + '" : {\n'); }
      else { this.push('{\n"' + this.keyStr + '" : [\n'); }
    }
  }
  _transform(obj: any, _enc: BufferEncoding, cb: TransformCallback) {
    if (this.keyStr) {
      if (!Array.isArray(obj)) { this.push((this.written ? ',\n' : '') + JSON.stringify(obj)); }
      else { this.push((this.written ? ',\n' : '') + '\t"' + obj[0] + '":' + obj[1]); }
      this.written = true;
    } else {
      this.push(obj);
    }
    cb();
  }
  _flush(cb: TransformCallback) {
    if (this.keyStr) {
      const self = this;
      const used_key = this.keyStr;
      const template = this.template;
      const remaining_keys = Object.keys(template).filter(function(key) { return key !== used_key; });
      this.push('\n' + (this.isArr ? ']' : '}') + (remaining_keys.length > 0 ? ',' : '') + '\n');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const transformer = require('..');
      remaining_keys.forEach(function(key, idx) {
        const transformed_context = transformer({}, template[key], self.env);
        (self as any).push('\t"' + key + '":' + JSON.stringify(transformed_context) + (idx < (remaining_keys.length - 1) ? ',' : '') + '\n');
      });
      this.push('}\n');
    }
    cb();
  }
}

class Collector extends Transform {
  private collected: any[];
  private lastid: any;
  constructor(options?: any) {
    super({ ...(options || {}), objectMode: true });
    this.collected = [];
    this.lastid = null;
  }
  _transform(obj: any, _enc: BufferEncoding, cb: TransformCallback) {
    if (this.lastid !== null && this.lastid !== obj.KEY) {
      if (this.collected.length > 0) { this.push([this.lastid, JSON.stringify(([] as any[]).concat(this.collected))]); }
      this.collected = [];
    }
    this.collected.push(obj);
    this.lastid = obj.KEY;
    delete obj.KEY;
    cb();
  }
  _flush(cb: TransformCallback) {
    if (this.collected.length > 0) { this.push([this.lastid, JSON.stringify(([] as any[]).concat(this.collected))]); }
    cb();
  }
}

const convert_selector = function(selector: string) {
  let emit_keys = false;
  if (selector.indexOf('.$') > 0) { emit_keys = true; selector = selector.replace('.$', ''); }
  // Extract trailing [ (expr) ] for key/filter
  let key: string | null = null;
  let filter: string | null = null;
  const trailing = selector.match(/\[(?:\s*)\((.*)\)(?:\s*)\]$/);
  if (trailing && trailing[1]) {
    const expr = trailing[1].trim();
    if (expr.startsWith('?(')) { filter = expr; }
    else { key = '(' + expr + ')'; }
    selector = selector.slice(0, selector.length - trailing[0].length);
  }
  // Remove root and compute base path for JSONStream
  let base = selector.replace(/^\$\.?/, '');
  base = base.replace(/\[(?:\*|\d+|'.*?'|".*?")\]$/, '');
  const key_path = emit_keys ? '$*' : '*';
  const path = base ? base + '.' + key_path : key_path;
  return { path, key, filter } as any;
};

const stream_transform_array = function(stream: any, template: any, env: any) {
  const selector = convert_selector(template[0])!;
  return stream.pipe(JSONStream.parse(selector.path)).pipe(new (ObjectTransform as any)(template[1], env));
};

const stream_transform_object_array = function(stream: any, template: any, env: any) {
  const selector = convert_selector(template[0])!;
  return stream.pipe(new (JSONFilter as any)(selector.filter)).pipe(new (ObjectTransform as any)(template[1], env));
};

const stream_transform_collect = function(stream: any, template: any, env: any) {
  const selectors = Object.keys(template);
  const output = new PassThrough({ objectMode: true });
  selectors.forEach(function(selector_string) {
    const selector = convert_selector(selector_string)!;
    return stream
      .pipe(JSONStream.parse(selector.path))
      .pipe(new JSONFilter(selector.filter))
      .pipe(new ObjectTransform(template[selector_string], env))
      .pipe(new KeyExtractor(selector.key))
      .pipe(output);
  });
  return output.pipe(sort() as any).pipe(new Collector());
};

const stream_transform_object_collect = function(stream: any, template: any, env: any) {
  const selectors = Object.keys(template);
  const output = new PassThrough({ objectMode: true });
  let any_selector = false;
  selectors.forEach(function(selector_string) {
    const selector = convert_selector(selector_string)!;
    if (!selector) { return; }
    any_selector = true;
    stream
      .pipe(new JSONFilter(selector.filter))
      .pipe(new ObjectTransform(template[selector_string], env))
      .pipe(new KeyExtractor(selector.key))
      .pipe(output);
  });
  if (!any_selector) { output.end(); }
  return output.pipe(sort() as any).pipe(new Collector());
};

const stream_transform = function(stream: any, template: any, env: any) {
  if (Array.isArray(template)) { return stream_transform_array(stream, template, env); }
  return stream_transform_collect(stream, template, env);
};

const stream_transform_object = function(stream: any, template: any, env: any) {
  if (Array.isArray(template)) { return stream_transform_object_array(stream, template, env); }
  return stream_transform_object_collect(stream, template, env);
};

export default function makeObjectStream(template: any, key?: string, env?: any) {
  const input_stream = new PassThrough({ objectMode: true });
  input_stream.on('pipe', function(src: any) {
    if (src.transformed) { return; }
    let transformed_stream: any = null;
    if (!src._readableState || src._readableState.objectMode) {
      if (src.unpipe) { src.unpipe(input_stream); }
      else { unpipe(src as any); }
      if (key) { (input_stream as any)._readableState.objectMode = false; }
      transformed_stream = stream_transform_object(src, key ? (template as any)[key] : template, env)
        .pipe(new ContextWriter(template, key as any, Array.isArray(key ? (template as any)[key] : template), env));
    } else {
      src.unpipe(input_stream);
      if (key) { (input_stream as any)._readableState.objectMode = false; }
      transformed_stream = stream_transform(src, key ? (template as any)[key] : template, env)
        .pipe(new ContextWriter(template, key as any, Array.isArray(key ? (template as any)[key] : template), env));
    }
    transformed_stream.transformed = true;
    transformed_stream.pipe(input_stream);
  });
  return input_stream;
}
