export interface JexlExpression {
  eval(context?: Record<string, unknown>): unknown
  readonly source?: string
}

export interface JexlInstance {
  compile(code: string): JexlExpression
}

/** The `jexl:` prefix marks a config value as a deferred callback expression. */
export const JEXL_PREFIX = 'jexl:'

export function isJexl(str: unknown): str is string {
  return typeof str === 'string' && str.startsWith(JEXL_PREFIX)
}

/**
 * The characters an expression nearly always holds and a field name never
 * does, so a string holding one with no `jexl:` prefix is an expression
 * missing its prefix.
 */
export const EXPRESSION_CHARACTERS = /[()=<>!&|]/

/** Whether `value` is an expression written without its `jexl:` prefix. */
export function isBareExpression(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !isJexl(value) &&
    EXPRESSION_CHARACTERS.test(value)
  )
}

/** Add the `jexl:` prefix unless the string already carries it. */
export function ensureJexlPrefix(code: string) {
  return isJexl(code) ? code : `${JEXL_PREFIX}${code}`
}

/**
 * Compile a `jexl:...` string to an Expression. The jexl instance caches
 * compilation, so this only strips the prefix.
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
