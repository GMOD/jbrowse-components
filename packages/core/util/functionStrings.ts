export const functionRegexp = /^\s*function\s*\(([^)]*)\)\s*{([\w\W]*)/

const compilationCache: Record<string, Function> = {}

/**
 * compile a function to a string
 *
 * @param {string} str string of code like "function() { ... }"
 * @param {object} options
 * @param {string[]?} options.verifyFunctionSignature if passed, the
 *  compiled function will check at runtime that the proper number
 *  of arguments were passed to it
 * @param {any[]} options.bind if passed, the
 *  compiled function will be bound (by calling bind on it) with
 *  the given context and arguments
 */
export function stringToFunction(
  str: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: { verifyFunctionSignature?: string[]; bind?: any[] } = {},
) {
  const { verifyFunctionSignature } = options

  const cacheKey = `${
    verifyFunctionSignature ? verifyFunctionSignature.join(',') : 'nosig'
  }|${str}`
  if (!compilationCache[cacheKey]) {
    const match = functionRegexp.exec(str)
    if (!match) {
      throw new Error('string does not appear to be a function declaration')
    }
    const paramList = match[1].split(',').map(s => s.trim())
    let code = match[2].replace(/}\s*$/, '')
    if (verifyFunctionSignature) {
      // check number of arguments passed by calling code at runtime.
      // NOTE: we don't check the number of arguments in the callback code itself,
      // callback authors are free to ignore the arguments if they want

      code = `if (arguments.length !== ${
        verifyFunctionSignature.length
      }) throw new Error("incorrect number of arguments provided to callback.  function signature is (${verifyFunctionSignature.join(
        ', ',
      )}) but "+arguments.length+" arguments were passed");\n${code}`
    }

    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const compiled = new Function(...paramList, `"use strict"; ${code}`)
    compilationCache[cacheKey] = compiled
  }

  let func = compilationCache[cacheKey]
  if (options.bind) {
    const [thisArg, ...rest] = options.bind
    func = func.bind(thisArg, ...rest)
  }
  return func
}
