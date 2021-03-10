import jexl from 'jexl'
import { Feature } from './simpleFeature'

type JexlWithAddFunction = typeof jexl & {
  addFunction(name: string, func: Function): void
}
type JexlNonBuildable = Omit<typeof jexl, 'Jexl'>

function createJexlInstance(/* config?: any*/): JexlNonBuildable {
  const jexlInstance = new jexl.Jexl()
  // someday will make sure all of configs callbacks are added in, including ones passed in

  // below are core functions
  jexlInstance.addTransform('getData', (feature: Feature, data: string) => {
    return feature.get(data)
  })

  jexlInstance.addTransform('getId', (feature: Feature) => {
    return feature.id()
  })

  // let user cast a jexl type into a javascript type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jexlInstance.addTransform('cast', (arg: any) => {
    return arg
  })

  // logging
  jexlInstance.addTransform('log', (thing: unknown) => {
    // eslint-disable-next-line no-console
    console.log(thing)
    return thing
  })

  // math
  // addfunction added in jexl 2.3 but types/jexl still on 2.2
  ;(jexlInstance as JexlWithAddFunction).addFunction('max', Math.max)
  ;(jexlInstance as JexlWithAddFunction).addFunction('min', Math.min)
  jexlInstance.addTransform('sqrt', Math.sqrt)
  jexlInstance.addTransform('ceil', Math.ceil)
  jexlInstance.addTransform('floor', Math.floor)
  jexlInstance.addTransform('round', Math.round)
  jexlInstance.addTransform('abs', Math.abs)

  // string
  jexlInstance.addTransform('split', (str: string, char: string) =>
    str.split(char),
  )
  jexlInstance.addTransform('charAt', (str: string, index: number) =>
    str.charAt(index),
  )
  jexlInstance.addTransform('charCodeAt', (str: string, index: number) =>
    str.charCodeAt(index),
  )
  jexlInstance.addTransform('codePointAt', (str: string, pos: number) =>
    str.codePointAt(pos),
  )
  jexlInstance.addTransform(
    'endsWith',
    (str: string, searchStr: string, length?: number | undefined) => {
      str.endsWith(searchStr, length)
    },
  )
  jexlInstance.addTransform(
    'padEnd',
    (str: string, targetLength: number, padString?: string | undefined) => {
      str.padEnd(targetLength, padString)
    },
  )
  jexlInstance.addTransform(
    'padStart',
    (str: string, targetLength: number, fillString?: string | undefined) => {
      str.padStart(targetLength, fillString)
    },
  )
  jexlInstance.addTransform('repeat', (str: string, count: number) => {
    str.repeat(count)
  })
  jexlInstance.addTransform(
    'replace',
    (str: string, match: string, newSubStr: string) => {
      str.replace(match, newSubStr)
    },
  )
  jexlInstance.addTransform(
    'replaceAll',
    (str: string, match: string, newSubStr: string) => {
      str.replaceAll(match, newSubStr)
    },
  )
  jexlInstance.addTransform(
    'slice',
    (str: string, start: number, end?: number | undefined) => {
      str.slice(start, end)
    },
  )
  jexlInstance.addTransform(
    'startsWith',
    (str: string, searchStr: string, position?: number | undefined) => {
      str.startsWith(searchStr, position)
    },
  )
  jexlInstance.addTransform(
    'substring',
    (str: string, start: number, end?: number | undefined) => {
      str.substring(start, end)
    },
  )
  jexlInstance.addTransform('toLowerCase', (str: string) => {
    str.toLowerCase()
  })
  jexlInstance.addTransform('toUpperCase', (str: string) => {
    str.toUpperCase()
  })
  jexlInstance.addTransform('trim', (str: string) => {
    str.trim()
  })
  jexlInstance.addTransform('trimEnd', (str: string) => {
    str.trimEnd()
  })
  jexlInstance.addTransform('trimStart', (str: string) => {
    str.trimStart()
  })

  jexlInstance.addTransform('hashcode', (str: string) => {
    return str
      .split('')
      .map(c => c.charCodeAt(0))
      .reduce((a, b) => a + b, 0)
  })

  // eslint-disable-next-line no-bitwise
  jexlInstance.addBinaryOp('&', 15, (a: number, b: number) => a & b)

  return jexlInstance
}

export default createJexlInstance
