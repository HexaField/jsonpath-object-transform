import * as acorn from 'acorn'
import { JSONPath } from 'jsonpath-plus'
import evaluate from 'static-eval'

// Simple env scoping helper (replaces jsonPath.withEnv)
function withEnv(env: Record<string, any>, actions: () => void) {
  ;(withEnv as any)._env = env || {}
  try {
    actions()
  } finally {
    ;(withEnv as any)._env = {}
  }
}

function currentEnv(): Record<string, any> {
  return (withEnv as any)._env || {}
}

// Normalize '@' references to CTX for JS parsing
function normalizeExpr(src: string): string {
  // Replace all occurrences of JSONPath @ (current node) with CTX for JS parsing
  // This is a broad replacement and assumes '@' only appears as the JSONPath current-node token.
  return src.replace(/@/g, 'CTX')
}

function evalExpression(src: string, ctx: any, env: Record<string, any>): any {
  const code = normalizeExpr(src)
  const ast = (acorn.parse(code, { ecmaVersion: 2020 }) as any).body[0].expression
  const scope = Object.assign({ CTX: ctx }, env)
  return evaluate(ast, scope)
}

function evalExpressionWithResultContainer(src: string, ctx: any, env: Record<string, any>): any {
  const code = normalizeExpr(src)
  const ast = (acorn.parse(code, { ecmaVersion: 2020 }) as any).body[0].expression
  const container: Record<string, any> = {}
  const wrappedEnv: Record<string, any> = {}
  Object.keys(env || {}).forEach((k) => {
    const fn = env[k]
    if (typeof fn === 'function') {
      // Only inject the container as the first argument if the function
      // is declared to accept it (arity >= 2). Otherwise, call as-is.
      wrappedEnv[k] = function (...args: any[]) {
        if (fn.length >= 2) {
          return fn(container, ...args)
        }
        return fn(...args)
      }
    } else {
      wrappedEnv[k] = env[k]
    }
  })
  const scope = Object.assign({ CTX: ctx }, wrappedEnv)
  const key = evaluate(ast, scope)
  let keyStr = typeof key === 'string' ? key : String(key)
  // Allow env functions to return quoted keys like '\'key\''
  const m = /^['"](.*)['"]$/.exec(keyStr)
  if (m && typeof m[1] === 'string') {
    keyStr = m[1]
  }
  return container[keyStr]
}

function jpQuery(json: any, pathStr: string, ctxForScripts: any, env: Record<string, any>): any[] {
  // Handle member script at end: ....(expr)
  const memberMatch = /(.*)\.\((.*)\)$/.exec(pathStr || '')
  if (memberMatch) {
    const basePath = memberMatch[1] || '$'
    const expr = memberMatch[2] as string
    const baseVals = JSONPath({ path: basePath, json, wrap: true }) as any[]
    return baseVals.map((val) => evalExpression(expr, val, env))
  }
  // Handle subscript script at end: ...[(expr)]
  const subscriptMatch = /(.*)\[(?:\s*)\((.*)\)(?:\s*)\]$/.exec(pathStr || '')
  if (subscriptMatch) {
    const basePath = subscriptMatch[1] || '$'
    const expr = subscriptMatch[2] as string
    const baseVals = JSONPath({ path: basePath, json, wrap: true }) as any[]
    const out: any[] = []
    const looksLikeContainerCall = /\w+\s*\([^)]*,/.test(expr)
    baseVals.forEach((val) => {
      const contexts = Array.isArray(val) ? val : [val]
      contexts.forEach((ctx) => {
        // First, evaluate expression normally to a key/index
        let keyVal: any
        try {
          keyVal = evalExpression(expr, ctx, env)
        } catch (_) {
          keyVal = undefined
        }
        // If we got a string like '\'key\'', unquote
        let keyStr: string | number | undefined = keyVal
        if (typeof keyVal === 'string') {
          const m = /^(?:['"])(.*)(?:['"])$/.exec(keyVal)
          keyStr = m && m[1] ? m[1] : keyVal
        }
        // If expression yielded a property/index, try to resolve within current context
        if (keyStr !== undefined && keyStr !== null) {
          if (Array.isArray(ctx)) {
            const idx = typeof keyStr === 'number' ? keyStr : Number(keyStr)
            if (!Number.isNaN(idx) && typeof ctx[idx] !== 'undefined') {
              out.push(ctx[idx])
              return
            }
          } else if (ctx && typeof ctx === 'object') {
            const k = String(keyStr)
            if (Object.prototype.hasOwnProperty.call(ctx, k)) {
              out.push(ctx[k])
              return
            }
          }
        }
        // Fallback: allow env functions which write into a container-like target
        if (looksLikeContainerCall) {
          try {
            const res = evalExpressionWithResultContainer(expr, ctx, env)
            if (typeof res !== 'undefined') {
              out.push(res)
              return
            }
          } catch (e) {
            /* ignore and fall back to raw eval */
          }
        }
        // Last resort: return the raw evaluated value
        out.push(keyVal)
      })
    })
    return out
  }
  // Default: normal JSONPath
  return JSONPath({ path: pathStr, json, wrap: true }) as any[]
}

type AnyObject = Record<string, any>

function typeOf(
  obj: any
): 'array' | 'object' | 'number' | 'string' | 'boolean' | 'function' | 'undefined' | 'bigint' | 'symbol' {
  return Array.isArray(obj) ? 'array' : typeof obj
}

function seekSingle(data: any, pathStr: string, result: AnyObject, key: any) {
  if (pathStr === '$' || pathStr === '@') {
    if (key.toString().indexOf('.*') >= 0 && data && typeof data === 'object') {
      const prefix = key.replace('.*', '')
      Object.keys(data)
        .filter(function (outkey) {
          return outkey.indexOf(prefix) === 0
        })
        .forEach(function (outkey) {
          result[outkey] = data[outkey]
        })
      return
    }
    result[key] = data
    return
  }

  if (pathStr[0] === '@') {
    if (pathStr.length > 1) {
      if (pathStr[1] === '.') {
        pathStr = '$' + pathStr.slice(1)
      } else {
        pathStr = '$.' + pathStr.slice(1)
      }
    }
  }

  if (pathStr.indexOf('$') !== 0 && pathStr.indexOf('@') !== 0) {
    result[key] = pathStr
    return
  }

  const seek = jpQuery(data, pathStr, data, currentEnv()) || []

  if (key.toString().indexOf('.*') >= 0 && seek.length > 0) {
    const base = seek[0]
    const prefix2 = key.replace('.*', '')
    if (base && typeof base === 'object') {
      Object.keys(base)
        .filter(function (outkey) {
          return outkey.indexOf(prefix2) === 0
        })
        .forEach(function (outkey) {
          result[outkey] = base[outkey]
        })
      return
    }
  }

  result[key] = seek.length ? seek[0] : undefined
}

function seekArray(data: any, pathArr: any[], result: AnyObject, key: any) {
  const original_result = result
  const subpath = pathArr[1]
  const path = pathArr[0]
  if (!path) {
    ;(result as any)[key] = pathArr
    return
  }
  if ((path as string).indexOf('$') !== 0 && (path as string).indexOf('@') !== 0) {
    if (Array.isArray(path)) {
      ;(result as any)[key] = []
      seekArray(data, path as any, (result as any)[key], 0)
      return
    }
    ;(result as any)[key] = pathArr
    return
  }

  const seek = jpQuery(data, path as string, data, currentEnv()) || []

  if (seek.length && subpath) {
    const arr: any[] = []
    ;(result as any)[key] = arr
    if (Array.isArray(seek[0])) {
      seek[0].forEach(function (item: any, index: number) {
        walk(item, subpath, arr as any, index)
      })
    } else {
      seek.forEach(function (item: any, index: number) {
        walk(item, subpath, arr as any, index)
      })
    }
    if (subpath.ARRAY === 'collapse') {
      const collapsed = arr[0]
      if (collapsed && typeof collapsed === 'object') {
        delete collapsed.ARRAY
      }
      ;(original_result as any)[key] = collapsed
      return
    }

    arr.forEach(function (obj, idx) {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(function (k) {
          if (obj[k] === undefined) {
            delete obj[k]
          }
        })
        if (Object.keys(obj).length === 0) {
          ;(arr as any)[idx] = undefined
        }
      }
    })

    if (subpath.ARRAY === true) {
      arr.forEach(function (obj, idx) {
        delete obj.ARRAY
        const res: any[] = []
        Object.keys(obj).forEach(function (i) {
          res[parseInt(i as any, 10)] = obj[i]
        })
        ;(arr as any)[idx] = res
      })
    }
    while (arr.indexOf(null) >= 0) {
      arr.splice(arr.indexOf(null), 1)
    }
    while (arr.indexOf(undefined) >= 0) {
      arr.splice(arr.indexOf(undefined), 1)
    }
  } else {
    ;(result as any)[key] = seek
  }
}

function iterateKeysObject(data: any, template: any, result: AnyObject, searchPath: string) {
  // If grouping path uses a script-expression subscript, we can't rely on jsonpath-plus.
  const scriptMatch = /(.*)\[(?:\s*)\((.*)\)(?:\s*)\]$/.exec(searchPath || '')
  if (scriptMatch) {
    const basePart = scriptMatch[1] || '$'
    const expr = scriptMatch[2] as string
    const contexts: any[] = []
    if (/\.\.$/.test(basePart)) {
      // Descendant selector case: only group when traversing an array-like root
      // Legacy behavior avoided grouping on objects at arbitrary depths for $..[(@...)] on wrapped roots
      const baseVals = JSONPath({ path: basePart.replace(/\.$/, ''), json: data, wrap: true }) as any[]
      baseVals.forEach((v) => {
        if (Array.isArray(v)) {
          contexts.push(...v)
        }
      })
    } else {
      const baseVals = JSONPath({ path: basePart, json: data, wrap: true }) as any[]
      baseVals.forEach((v) => {
        if (Array.isArray(v)) {
          contexts.push(...v)
        } else {
          contexts.push(v)
        }
      })
    }
    contexts.forEach((ctx) => {
      const keyVal = evalExpression(expr, ctx, currentEnv())
      if (!keyVal) {
        return
      }
      String(keyVal)
        .split(/[,;\s]+/)
        .forEach(function (split_key: string) {
          if (!result[split_key]) {
            result[split_key] = []
          }
          const res: AnyObject = {}
          walk(ctx, template, res)
          result[split_key].push(res)
        })
    })
    return
  }

  // Default: Pull keys and their parent objects using aligned result arrays
  const keys = JSONPath({ path: searchPath, json: data, wrap: true }) as any[]
  const parents = JSONPath({ path: searchPath, json: data, resultType: 'parent', wrap: true }) as any[]
  parents.forEach(function (obj: any, idx: number) {
    const object_key = keys[idx]
    if (!object_key) {
      return
    }
    object_key.split(/[,;\s]+/).forEach(function (split_key: string) {
      if (!result[split_key]) {
        result[split_key] = []
      }
      const res: AnyObject = {}
      walk(obj, template, res)
      result[split_key].push(res)
    })
  })
}

function seekObject(data: any, pathObj: any, result: AnyObject, key?: any) {
  const inresult = result
  if (typeof key !== 'undefined') {
    if ((key + '').indexOf('$') >= 0) {
      return iterateKeysObject(data, pathObj, result, key)
    }
    result = (result as any)[key] = {}
  }
  Object.keys(pathObj).forEach(function (name) {
    walk(data, pathObj[name], result, name)
  })
  if (pathObj.ARRAY === true) {
    const res: any[] = []
    Object.keys(result).forEach(function (idx) {
      if (idx === 'ARRAY') {
        return
      }
      res[parseInt(idx as any, 10)] = (result as any)[idx]
    })
    ;(inresult as any)[key] = res
  }
}

function walk(data: any, path: any, result: AnyObject, key?: any) {
  let fn: any
  switch (typeOf(path)) {
    case 'string':
      fn = seekSingle
      break
    case 'number':
      ;(result as any)[key] = path
      break
    case 'array':
      fn = seekArray
      break
    case 'object':
      fn = seekObject
      break
  }
  if (fn) {
    fn(data, path, result, key)
  }
}

export default function transform(data: any, path: any, env?: Record<string, any>) {
  const result: AnyObject = {}
  if (!env) {
    env = {}
  } else {
    Object.freeze(env)
  }
  withEnv(env, function () {
    walk(data, path, result)
  })
  return result
}
