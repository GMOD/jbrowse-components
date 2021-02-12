import createJexlInstance from './jexl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compilationCache: Record<string, any> = {}

// revert function strings back to master, create a different file for jexlStrings.ts
// pass the jexl property of the pluginManager as a param

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
  } = {},
  // jexl?: any,
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
