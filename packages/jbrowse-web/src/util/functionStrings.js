export const functionRegexp = /^\s*function\s*\(([^)]*)\)\s*{([\w\W]*)/

const compilationCache = {}
/**
 * compile a function to a string
 *
 * @param {string} str string of code like "function() { ... }"
 * @param {object} options
 * @param {object} options.verifyFunctionSignature if true, the compiled function will check at runtime that the proper number of arguments were passed to it
 */
export function stringToFunction(str, options = {}) {
  const { verifyFunctionSignature } = options

  const cacheKey = `${verifyFunctionSignature &&
    verifyFunctionSignature.join(',')}|${str}`
  if (compilationCache[cacheKey]) return compilationCache[cacheKey]

  const match = functionRegexp.exec(str)
  if (!match)
    throw new Error('string does not appear to be a function declaration')
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
  const func = new Function(...paramList, `"use strict"; ${code}`) // eslint-disable-line
  compilationCache[cacheKey] = func
  return func
}
