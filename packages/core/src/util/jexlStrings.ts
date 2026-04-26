import createJexlInstance from './jexl.ts'

export interface JexlExpression {
  eval(context?: Record<string, unknown>): unknown
  _exprStr?: string
}

export interface JexlInstance {
  compile(code: string): JexlExpression
}

const compilationCache: Record<string, JexlExpression> = {}

// revert function strings back to main, create a different file for
// jexlStrings.ts pass the jexl property of the pluginManager as a param

/**
 * compile a jexlExpression to a string
 *
 * @param str - string of code like `jexl:...`
 * @param options -
 */
export function stringToJexlExpression(str: string, jexl?: JexlInstance) {
  if (!compilationCache[str]) {
    if (!str.startsWith('jexl:')) {
      throw new Error('string does not appear to be in jexl format')
    }
    const code = str.slice('jexl:'.length)
    const compiled = jexl
      ? jexl.compile(code)
      : createJexlInstance().compile(code)
    compilationCache[str] = compiled
  }

  return compilationCache[str]
}
