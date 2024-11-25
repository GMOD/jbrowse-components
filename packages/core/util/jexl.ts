import jexl from 'jexl'
import type { Feature } from './simpleFeature'

type JexlWithAddFunction = typeof jexl & {
  addFunction(name: string, func: (...args: unknown[]) => unknown): void
}
type JexlNonBuildable = Omit<typeof jexl, 'Jexl'>

export default function JexlF(/* config?: any*/): JexlNonBuildable {
  const j = new jexl.Jexl() as JexlWithAddFunction
  // someday will make sure all of configs callbacks are added in, including
  // ones passed in

  // below are core functions
  j.addFunction('get', (feature: Feature, data: string) => feature.get(data))
  j.addFunction('parent', (feature: Feature) => feature.parent())

  j.addFunction('id', (feature: Feature) => feature.id())

  // let user cast a jexl type into a javascript type
  j.addFunction('cast', (arg: unknown) => arg)

  // logging
  j.addFunction('log', (thing: unknown) => {
    console.log(thing) // eslint-disable-line no-console
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
  j.addFunction('log10', Math.log10)
  j.addFunction('parseInt', Number.parseInt)
  j.addFunction('parseFloat', Number.parseFloat)

  // string
  j.addFunction('split', (s: string, char: string) => s.split(char))
  j.addFunction('charAt', (s: string, index: number) => s.charAt(index))
  j.addFunction('charCodeAt', (s: string, index: number) => s.charCodeAt(index))
  j.addFunction('codePointAt', (s: string, pos: number) => s.codePointAt(pos))
  j.addFunction('startsWith', (s: string, search: string, len?: number) =>
    s.startsWith(search, len),
  )
  j.addFunction('endsWith', (s: string, search: string, len?: number) =>
    s.endsWith(search, len),
  )
  j.addFunction('padEnd', (s: string, len: number, pad?: string) =>
    s.padEnd(len, pad),
  )
  j.addFunction('padStart', (s: string, len: number, fill?: string) =>
    s.padStart(len, fill),
  )
  j.addFunction('repeat', (s: string, count: number) => s.repeat(count))
  j.addFunction('replace', (s: string, match: string, sub: string) =>
    s.replace(match, sub),
  )
  j.addFunction('replaceAll', (s: string, match: string, sub: string) =>
    s.replaceAll(match, sub),
  )
  j.addFunction('slice', (s: string, start: number, end?: number) =>
    s.slice(start, end),
  )
  j.addFunction('startsWith', (s: string, search: string, pos?: number) =>
    s.startsWith(search, pos),
  )
  j.addFunction('substring', (s: string, start: number, end?: number) =>
    // eslint-disable-next-line unicorn/prefer-string-slice
    s.substring(start, end),
  )
  j.addFunction('toLowerCase', (s: string) => s.toLowerCase())
  j.addFunction('toUpperCase', (s: string) => s.toUpperCase())
  j.addFunction('jsonParse', (s: string) => JSON.parse(s))
  j.addFunction('trim', (s: string) => s.trim())
  j.addFunction('trimEnd', (s: string) => s.trimEnd())
  j.addFunction('trimStart', (s: string) => s.trimStart())

  j.addFunction('getTag', (feature: Feature, s: string) => {
    const tags = feature.get('tags')
    return tags ? tags[s] : feature.get(s)
  })

  j.addBinaryOp('&', 15, (a: number, b: number) => a & b)

  return j
}
