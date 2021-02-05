import jexl from './jexl'

export const functionRegexp = /^\s*function\s*\w*\s*\(([^)]*)\)\s*{([\w\W]*)/

const compilationCache: Record<string, Function> = {}

// TODO HERE IS WHERE FUNCITONS GET EVALED

/**
 * compile a function to a string
 *
 * @param str - string of code like `function() { ... }`
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
    bind?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  } = {},
) {
  const { verifyFunctionSignature } = options

  const cacheKey = `${
    verifyFunctionSignature ? verifyFunctionSignature.join(',') : 'nosig'
  }|${str}`
  if (!compilationCache[cacheKey]) {
    const match = str.startsWith('jexl:')
    if (!match) {
      throw new Error('string does not appear to be a function declaration')
    }
    // remove when transition to just jexl
    const code = str.split('jexl:')[1]
    // if (verifyFunctionSignature && match) {
    //   // check number of arguments passed by calling code at runtime.
    //   // NOTE: we don't check the number of arguments in the callback code itself,
    //   // callback authors are free to ignore the arguments if they want

    //   code = `if (arguments.length !== ${
    //     verifyFunctionSignature.length
    //   }) throw new Error("incorrect number of arguments provided to callback.  function signature is (${verifyFunctionSignature.join(
    //     ', ',
    //   )}) but "+arguments.length+" arguments were passed");\n${code}`
    // }

    const compiled = jexl.createExpression(`${code}`) // replace this with jexl.createExpression with string that they typed, strip off the jexl: part

    compilationCache[cacheKey] = compiled
  }

  const func = compilationCache[cacheKey]
  // dont need this when using jexl
  // if (options.bind) {
  //   const [thisArg, ...rest] = options.bind
  //   func = func.bind(thisArg, ...rest)
  // }
  return func
}

// jexl.eval(getFeatureData(feature, 'strand') == "+" ? 'blue' : 'red', {feature})
// they will write everything inside the parenthesis except context
// so when jexl is added, called a set of utility functions
// jexl.addFunction('getFeatureData', {feature, data} => feature.get('data))
// in config callbacks, use expression.eval({{}} [context])

// have util file called jexl, imports jexl and adds utility functions, then export jexl
// put it in jbrowse/core
