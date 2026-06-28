import { Jexl } from '@jbrowse/jexl'

import { randomColor } from './color/index.ts'
import { colord } from './colord.ts'

import type { Colord } from './colord.ts'
import type { Feature } from './simpleFeature.ts'

export default function JexlF(/* config?: any*/) {
  const j = new Jexl()
  // someday will make sure all of configs callbacks are added in, including
  // ones passed in

  // below are core functions
  j.addFunction('get', (feature: Feature, data: string) => feature.get(data))

  // parent/id read as a method on a raw feature, but as a value on a
  // jexlFeatureProxy (jexl has no member-call syntax) — tolerate both
  j.addFunction('parent', (feature: Feature) => {
    const p: unknown = feature.parent
    return typeof p === 'function' ? p.call(feature) : p
  })
  j.addFunction('id', (feature: Feature) => {
    const i: unknown = feature.id
    return typeof i === 'function' ? i.call(feature) : i
  })

  // let user cast a jexl type into a javascript type
  j.addFunction('cast', (arg: unknown) => arg)

  // math
  // addfunction added in jexl 2.3 but types/jexl still on 2.2
  /** #jexlFunction Math functions | max(0, 2) */
  j.addFunction('max', Math.max)
  /** #jexlFunction Math functions | min(0, 2) */
  j.addFunction('min', Math.min)
  /** #jexlFunction Math functions | sqrt(4) */
  j.addFunction('sqrt', Math.sqrt)
  /** #jexlFunction Math functions | ceil(0.5) */
  j.addFunction('ceil', Math.ceil)
  /** #jexlFunction Math functions | floor(0.5) */
  j.addFunction('floor', Math.floor)
  /** #jexlFunction Math functions | round(0.5) */
  j.addFunction('round', Math.round)
  /** #jexlFunction Math functions | abs(-0.5) */
  j.addFunction('abs', Math.abs)
  /** #jexlFunction Math functions | log10(50000) */
  j.addFunction('log10', Math.log10)
  /** #jexlFunction Math functions | parseInt('2') */
  j.addFunction('parseInt', Number.parseInt)
  /** #jexlFunction Math functions | parseFloat('2.054') */
  j.addFunction('parseFloat', Number.parseFloat)

  // string
  /** #jexlFunction String functions | charAt('abc', 2) | c */
  j.addFunction('charAt', (s: string, index: number) => s.charAt(index))
  /** #jexlFunction String functions | charCodeAt(' ', 0) | 32 */
  j.addFunction('charCodeAt', (s: string, index: number) => s.charCodeAt(index))
  /** #jexlFunction String functions | codePointAt(' ', 0) | 32 */
  j.addFunction('codePointAt', (s: string, pos: number) => s.codePointAt(pos))
  /** #jexlFunction String functions | startsWith('kittycat', 'kit') | true */
  j.addFunction('startsWith', (s: string, search: string, len?: number) =>
    s.startsWith(search, len),
  )
  /** #jexlFunction String functions | endsWith('kittycat', 'cat') | true */
  j.addFunction('endsWith', (s: string, search: string, len?: number) =>
    s.endsWith(search, len),
  )
  /** #jexlFunction String functions | padStart('cat', 8, 'kitty') | kittycat */
  j.addFunction('padStart', (s: string, len: number, fill?: string) =>
    s.padStart(len, fill),
  )
  /** #jexlFunction String functions | padEnd('kitty', 8, 'cat') | kittycat */
  j.addFunction('padEnd', (s: string, len: number, pad?: string) =>
    s.padEnd(len, pad),
  )
  /** #jexlFunction String functions | replace('kittycat', 'cat', '') | kitty */
  j.addFunction('replace', (s: string, match: string, sub: string) =>
    s.replace(match, sub),
  )
  /** #jexlFunction String functions | replaceAll('kittycatcat', 'cat', '') | kitty */
  j.addFunction('replaceAll', (s: string, match: string, sub: string) =>
    s.replaceAll(match, sub),
  )
  /** #jexlFunction String functions | slice('kittycat', 5) | cat */
  j.addFunction('slice', (s: string, start: number, end?: number) =>
    s.slice(start, end),
  )
  /** #jexlFunction String functions | substring('kittycat', 0, 5) | kitty */
  j.addFunction('substring', (s: string, start: number, end?: number) =>
    s.substring(start, end),
  )
  /** #jexlFunction String functions | trim('  kitty ') | kitty, whitespace trimmed */
  j.addFunction('trim', (s: string) => s.trim())
  /** #jexlFunction String functions | trimStart('  kitty ') | kitty, starting whitespace trimmed */
  j.addFunction('trimStart', (s: string) => s.trimStart())
  /** #jexlFunction String functions | trimEnd('  kitty ') | kitty, ending whitespace trimmed */
  j.addFunction('trimEnd', (s: string) => s.trimEnd())
  /** #jexlFunction String functions | toUpperCase('kitty') | KITTY */
  j.addFunction('toUpperCase', (s: string) => s.toUpperCase())
  /** #jexlFunction String functions | toLowerCase('KITTY') | kitty */
  j.addFunction('toLowerCase', (s: string) => s.toLowerCase())
  /** #jexlFunction String functions | split('KITTY KITTY', ' ') | ['KITTY', 'KITTY'] */
  j.addFunction('split', (s: string, char: string) => s.split(char))
  /** #jexlFunction String functions | join('-', 'a', 'b', '', 'c') | a-b-c, joins truthy args with the separator */
  j.addFunction('join', (k: string, ...args: string[]) =>
    [...args].filter(f => !!f).join(k),
  )
  /** #jexlFunction String functions | includes('kittycat', 'cat') | true */
  j.addFunction('includes', (s: string, search: string) => s.includes(search))
  /** #jexlFunction String functions | repeat('ab', 3) | ababab */
  j.addFunction('repeat', (s: string, count: number) => s.repeat(count))
  /** #jexlFunction String functions | jsonParse('{"a":1}') | parses a JSON string */
  j.addFunction('jsonParse', (s: string) => JSON.parse(s))

  /**
   * #jexlFunction Feature operations - getTag | getTag(feature, 'MD') | fetches MD string from BAM or CRAM feature
   * #jexlFunction Feature operations - getTag | getTag(feature, 'HP') | fetches haplotype tag from BAM or CRAM feature
   */
  j.addFunction('getTag', (feature: Feature, s: string) => {
    const tags = feature.get('tags') as Record<string, unknown> | undefined
    return tags ? tags[s] : feature.get(s)
  })

  // color helpers
  /** #jexlFunction Color functions | randomColor(feature.type) | deterministic color from a string (e.g. a feature type) */
  j.addFunction('randomColor', randomColor)
  /** #jexlFunction Color functions | alpha('green', 0.5) | a color at 50% opacity */
  j.addFunction('alpha', (color: Colord, n: number) => color.alpha(n))
  /** #jexlFunction Color functions | hsl('#ff0000') | converts a color to its HSL form */
  j.addFunction('hsl', (color: Colord) => colord(color.toHsl()))
  /** #jexlFunction Color functions | colorString('green') | normalizes a color name or value to a hex string */
  j.addFunction('colorString', (color: Colord) => color.toHex())
  /** #jexlFunction Color functions | interpolate(feature.score, scale) | applies a scale function to a value */
  j.addFunction('interpolate', (count: number, scale: (n: number) => string) =>
    scale(count),
  )

  // logging
  /** #jexlFunction Console logging | log(feature) | console.logs output and returns value */
  j.addFunction('log', (thing: unknown) => {
    console.log(thing) // eslint-disable-line no-console
    return thing
  })

  /** #jexlFunction Binary operators | feature.flags & 2 | bitwise and to check if BAM or CRAM feature flags has 2 set */
  j.addBinaryOp('&', 15, (a: number, b: number) => a & b)

  return j
}
