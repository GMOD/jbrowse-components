export interface JexlExpression {
  eval(context?: Record<string, unknown>): unknown
  _exprStr?: string
}

export interface JexlInstance {
  compile(code: string): JexlExpression
}

/** The `jexl:` prefix marks a config value as a deferred callback expression. */
export const JEXL_PREFIX = 'jexl:'

export function isJexl(str: unknown): str is string {
  return typeof str === 'string' && str.startsWith(JEXL_PREFIX)
}

/** Add the `jexl:` prefix unless the string already carries it. */
export function ensureJexlPrefix(code: string) {
  return isJexl(code) ? code : `${JEXL_PREFIX}${code}`
}

/**
 * Compile a `jexl:...` string to an Expression. Compilation is memoized on the
 * jexl instance (see `createJexlInstance`), so this is a thin prefix-stripping
 * wrapper.
 *
 * @param str - string of code like `jexl:...`
 * @param jexl - the instance whose registered functions the expression may call
 *   (`pluginManager.jexl` on eval paths)
 */
export function stringToJexlExpression(str: string, jexl: JexlInstance) {
  if (!isJexl(str)) {
    throw new Error('string does not appear to be in jexl format')
  }
  return jexl.compile(str.slice(JEXL_PREFIX.length))
}
