import jexl from 'jexl'
import { Feature } from './simpleFeature'

type JexlWithAddFunction = typeof jexl & {
  addFunction(name: string, func: Function): void
}
type JexlNonBuildable = Omit<typeof jexl, 'Jexl'>

export default function (/* config?: any*/): JexlNonBuildable {
  const j = new jexl.Jexl() as JexlWithAddFunction
  // someday will make sure all of configs callbacks are added in, including
  // ones passed in

  // below are core functions
  j.addFunction('get', (feature: Feature, data: string) => {
    return feature.get(data)
  })

  j.addFunction('id', (feature: Feature) => {
    return feature.id()
  })

  // let user cast a jexl type into a javascript type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  j.addFunction('cast', (arg: any) => {
    return arg
  })

  // logging
  j.addFunction('log', (thing: unknown) => {
    // eslint-disable-next-line no-console
    console.log(thing)
    return thing
  })

  // math
  // addfunction added in jexl 2.3 but types/jexl still on 2.2
  j.addFunction('max', Math.max)
  j.addFunction('min', Math.min)
  j.addFunction('sqrt', Math.sqrt)
  j.addFunction('ceil', Math.ceil)
  j.addFunction('floor', Math.floor)
  j.addFunction('round', Math.round)
  j.addFunction('abs', Math.abs)
  j.addFunction('parseInt', Number.parseInt)

  // string
  j.addFunction('split', (str: string, char: string) => str.split(char))
  j.addFunction('charAt', (str: string, index: number) => str.charAt(index))
  j.addFunction('charCodeAt', (str: string, index: number) =>
    str.charCodeAt(index),
  )
  j.addFunction('codePointAt', (str: string, pos: number) =>
    str.codePointAt(pos),
  )
  j.addFunction(
    'startsWith',
    (str: string, searchStr: string, length?: number | undefined) =>
      str.startsWith(searchStr, length),
  )
  j.addFunction(
    'endsWith',
    (str: string, searchStr: string, length?: number | undefined) =>
      str.endsWith(searchStr, length),
  )
  j.addFunction(
    'padEnd',
    (str: string, targetLength: number, padString?: string | undefined) =>
      str.padEnd(targetLength, padString),
  )
  j.addFunction(
    'padStart',
    (str: string, targetLength: number, fillString?: string | undefined) =>
      str.padStart(targetLength, fillString),
  )
  j.addFunction('repeat', (str: string, count: number) => str.repeat(count))
  j.addFunction('replace', (str: string, match: string, newSubStr: string) =>
    str.replace(match, newSubStr),
  )
  j.addFunction('replaceAll', (str: string, match: string, newSubStr: string) =>
    str.replaceAll(match, newSubStr),
  )
  j.addFunction(
    'slice',
    (str: string, start: number, end?: number | undefined) =>
      str.slice(start, end),
  )
  j.addFunction(
    'startsWith',
    (str: string, searchStr: string, position?: number | undefined) =>
      str.startsWith(searchStr, position),
  )
  j.addFunction(
    'substring',
    (str: string, start: number, end?: number | undefined) =>
      str.substring(start, end),
  )
  j.addFunction('toLowerCase', (str: string) => str.toLowerCase())
  j.addFunction('toUpperCase', (str: string) => str.toUpperCase())
  j.addFunction('trim', (str: string) => {
    str.trim()
  })
  j.addFunction('trimEnd', (str: string) => str.trimEnd())
  j.addFunction('trimStart', (str: string) => str.trimStart())

  j.addFunction('getTag', (feature: Feature, str: string) => {
    const tags = feature.get('tags')
    return tags ? tags[str] : feature.get(str)
  })

  j.addBinaryOp('&', 15, (a: number, b: number) => a & b)

  return j
}
