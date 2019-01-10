export const functionRegexp = /^\s*function\s*\(([^)]*)\)\s*{([\w\W]*)/

export function stringToFunction(str) {
  const match = functionRegexp.exec(str)
  if (!match)
    throw new Error('string does not appear to be a function declaration')
  const paramList = match[1].split(',').map(s => s.trim())
  const code = match[2].replace(/}\s*$/, '')
        const func = new Function(...paramList, `"use strict"; ${code}`) // eslint-disable-line
  return func
}
