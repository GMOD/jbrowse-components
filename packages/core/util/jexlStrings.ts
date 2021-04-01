import createJexlInstance from './jexl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compilationCache: Record<string, any> = {}

// revert function strings back to main, create a different file for jexlStrings.ts
// pass the jexl property of the pluginManager as a param

/**
 * compile a jexlExpression to a string
 *
 * @param str - string of code like `jexl:...`
 * @param options -
 */
export function stringToJexlExpression(
  str: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jexl?: any,
) {
  const cacheKey = `nosig|${str}`
  if (!compilationCache[cacheKey]) {
    const match = str.startsWith('jexl:')
    if (!match) {
      throw new Error('string does not appear to be in jexl format')
    }
    const code = str.split('jexl:')[1]
    const compiled = jexl
      ? jexl.compile(`${code}`)
      : createJexlInstance().compile(`${code}`)
    compilationCache[cacheKey] = compiled
  }

  const expr = compilationCache[cacheKey]
  return expr
}
