export const functionRegexp = /^\s*function\s*\(([^)]*)\)\s*{([\w\W]*)/

export function stringToFunction(str, options = {}) {
  const { verifyFunctionSignature } = options
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
  return func
}
