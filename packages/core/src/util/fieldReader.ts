import { Jexl, analyze } from '@jbrowse/jexl'

import { JEXL_PREFIX, isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { buildJexlContext } from './simpleFeature.ts'

import type { JexlInstance } from './jexlStrings.ts'
import type { Feature } from './simpleFeature.ts'

/**
 * #api
 * What a channel reads off a feature: a field by name, a dotted path into a
 * structured field where no field has the whole name (`INFO.SVTYPE` on a
 * VCF record), or a `jexl:` expression over `feature`. A jexl expression that
 * does not compile throws here, once, rather than on every feature.
 */
export function fieldReader(
  ref: string,
  jexl: JexlInstance | undefined,
): (feature: Feature) => unknown {
  const path = ref.includes('.') ? ref.split('.') : undefined
  const rests = path?.map((_, i) => path.slice(i).join('.'))
  const name = plainFieldName(ref)
  if (name !== undefined) {
    return feature => feature.get(name)
  }
  if (isJexl(ref)) {
    if (!jexl) {
      throw new Error(`a jexl: field needs a jexl instance (${ref})`)
    }
    const expr = stringToJexlExpression(ref, jexl)
    return feature => expr.eval(buildJexlContext({ feature }))
  }
  return feature => {
    const value: unknown = feature.get(ref)
    return value === undefined && path && rests
      ? readPath(feature.get(path[0]!), path, rests)
      : value
  }
}

/**
 * #api
 * Whether a field ref is a bare name that `feature.get` reads directly,
 * with no path to walk and no expression to evaluate. A loop over a plain name
 * keeps the direct call, and only a config that writes a path pays for one.
 */
export function isPlainFieldRef(ref: string) {
  return !ref.includes('.') && !isJexl(ref)
}

const parser = new Jexl()

function parsed(ref: string) {
  try {
    return parser.parse(ref.slice(JEXL_PREFIX.length))
  } catch {
    return undefined
  }
}

/**
 * #api
 * Whether a `jexl:` ref answers the same for every feature: it reads no
 * variable and calls no function, as `jexl:'red'` does.
 */
export function isConstantJexl(ref: string) {
  const ast = isJexl(ref) ? parsed(ref) : undefined
  if (!ast) {
    return false
  }
  const { variables, calls } = analyze(ast)
  return variables.length === 0 && calls.length === 0
}

// jexlFeatureProxy answers these itself, so `feature.parent` is no field read
const PROXIED = new Set(['parent', 'uniqueId', 'get', 'toJSON'])

/**
 * #api
 * The field a ref reads by name: a plain ref itself, or the one field a
 * `jexl:` ref reads as `feature.score`, `feature['score']` or
 * `get(feature, 'score')` do, so such an expression takes a plain name's
 * columnar path.
 */
export function plainFieldName(ref: string) {
  if (!ref.startsWith(JEXL_PREFIX)) {
    return ref.includes('.') ? undefined : ref
  }
  const ast = parsed(ref)
  if (!ast) {
    return undefined
  }
  const viaGet = ast.type === 'FunctionCall' && ast.name === 'get'
  const { bare, reads } = analyze(ast, { accessors: { get: [] } })
  const [read] = reads
  const name = read?.path[0]
  return (bare || viaGet) &&
    reads.length === 1 &&
    read?.root === 'feature' &&
    !read.dynamic &&
    read.path.length === 1 &&
    typeof name === 'string' &&
    !name.includes('.') &&
    (viaGet || !PROXIED.has(name))
    ? name
    : undefined
}

function readPath(
  root: unknown,
  path: readonly string[],
  rests: readonly string[],
) {
  let value = root
  for (let i = 1; i < path.length; i++) {
    value =
      typeof value === 'object' && value !== null
        ? Reflect.get(value, path[i]!)
        : undefined
  }
  return value ?? readWholeRest(root, path, rests)
}

// A path that read nothing by descending tries each level's rest as one key,
// so `INFO.AF.EAS` reaches a key named `AF.EAS`, which VCF 4.3 allows. Only a
// miss pays for it: a path that resolves is the plain walk above.
function readWholeRest(
  root: unknown,
  path: readonly string[],
  rests: readonly string[],
) {
  let value = root
  for (let i = 1; i < path.length - 1; i++) {
    if (typeof value !== 'object' || value === null) {
      return undefined
    }
    const whole: unknown = Reflect.get(value, rests[i]!)
    if (whole !== undefined) {
      return whole ?? undefined
    }
    value = Reflect.get(value, path[i]!)
  }
  return undefined
}
