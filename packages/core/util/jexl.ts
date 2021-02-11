import jexl from 'jexl'
import { Feature } from './simpleFeature'

// below are core functions
jexl.addTransform('getData', (feature: Feature, data: string) => {
  return feature.get(data)
})

jexl.addTransform('getId', (feature: Feature) => {
  return feature.id()
})

// let user cast a jexl type into a javascript type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
jexl.addTransform('cast', (arg: any) => {
  return arg
})

// math
jexl.addFunction('max', Math.max)
jexl.addFunction('min', Math.min)
jexl.addTransform('sqrt', Math.sqrt)
jexl.addTransform('ceil', Math.ceil)
jexl.addTransform('floor', Math.floor)
jexl.addTransform('round', Math.round)
jexl.addTransform('abs', Math.abs)

// string
jexl.addTransform('split', (str: string, char: string) => str.split(char))
jexl.addTransform('charAt', (str: string, index: number) => str.charAt(index))
jexl.addTransform('charCodeAt', (str: string, index: number) =>
  str.charCodeAt(index),
)
jexl.addTransform('codePointAt', (str: string, pos: number) =>
  str.codePointAt(pos),
)
jexl.addTransform(
  'endsWith',
  (str: string, searchStr: string, length?: number | undefined) => {
    str.endsWith(searchStr, length)
  },
)
jexl.addTransform(
  'padEnd',
  (str: string, targetLength: number, padString?: string | undefined) => {
    str.padEnd(targetLength, padString)
  },
)
jexl.addTransform(
  'padStart',
  (str: string, targetLength: number, fillString?: string | undefined) => {
    str.padStart(targetLength, fillString)
  },
)
jexl.addTransform('repeat', (str: string, count: number) => {
  str.repeat(count)
})
jexl.addTransform(
  'replace',
  (str: string, match: string, newSubStr: string) => {
    str.replace(match, newSubStr)
  },
)
jexl.addTransform(
  'replaceAll',
  (str: string, match: string, newSubStr: string) => {
    str.replaceAll(match, newSubStr)
  },
)
jexl.addTransform(
  'slice',
  (str: string, start: number, end?: number | undefined) => {
    str.slice(start, end)
  },
)
jexl.addTransform(
  'startsWith',
  (str: string, searchStr: string, position?: number | undefined) => {
    str.startsWith(searchStr, position)
  },
)
jexl.addTransform(
  'substring',
  (str: string, start: number, end?: number | undefined) => {
    str.substring(start, end)
  },
)
jexl.addTransform('toLowerCase', (str: string) => {
  str.toLowerCase()
})
jexl.addTransform('toUpperCase', (str: string) => {
  str.toUpperCase()
})
jexl.addTransform('trim', (str: string) => {
  str.trim()
})
jexl.addTransform('trimEnd', (str: string) => {
  str.trimEnd()
})
jexl.addTransform('trimStart', (str: string) => {
  str.trimStart()
})

jexl.addTransform('hashcode', (str: string) => {
  return str
    .split('')
    .map(c => c.charCodeAt(0))
    .reduce((a, b) => a + b, 0)
})

// eslint-disable-next-line no-bitwise
jexl.addBinaryOp('&', 15, (a: number, b: number) => a & b)
// eslint-disable-next-line no-bitwise
jexl.addBinaryOp('|', 15, (a: number, b: number) => a | b)

function createJexlInstance(/* config?: any*/) {
  // someday will make sure all of configs callbacks are added in, including ones passed in
  return jexl
}

export default createJexlInstance
