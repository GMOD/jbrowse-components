import createJexlInstance from './jexl'

export const functionRegexp = /^\s*function\s*\w*\s*\(([^)]*)\)\s*{([\w\W]*)/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compilationCache: Record<string, any> = {}

/**
 * compile a jexlExpression to a string
 *
 * @param str - string of code like `jexl:...`
 * @param options -
 */
export function stringToJexlExpression(
  str: string,
  options: {
    /**
     * if passed, the compiled function will check at runtime that the proper
     * number of arguments were passed to it
     */
    verifyFunctionSignature?: string[]
    /**
     * if passed, the compiled function will be bound (by calling bind on it)
     * with the given context and arguments
     */
    // bind?: any[]
  } = {},
) {
  const { verifyFunctionSignature } = options

  const cacheKey = `${
    verifyFunctionSignature ? verifyFunctionSignature.join(',') : 'nosig'
  }|${str}`
  if (!compilationCache[cacheKey]) {
    const match = str.startsWith('jexl:')
    if (!match) {
      throw new Error('string does not appear to be in jexl format')
    }
    const code = str.split('jexl:')[1]
    const compiled = createJexlInstance().createExpression(`${code}`)
    compilationCache[cacheKey] = compiled
  }

  const func = compilationCache[cacheKey]
  return func
}
