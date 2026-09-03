// The two LGV fetch foundations each declare `host`, `viewportEmpty`,
// `canRender`, `dataSuperseded`, `paintInert` and `svgReady` over one shared
// body, and `displayPhase` over one mapping with one argument of their own.
//
// The duplication is the accepted shape, not an oversight waiting for a fold:
// a mixin under both foundations is the compose layer ADR-041 measured pushing
// twelve display chains past TypeScript's inference depth, and a delegated
// `.views(shared)` block is what ADR-073 reserves for one model keeping members
// elsewhere for size, not for sharing across models. What neither ADR supplies
// is the guard — nothing else notices when one copy grows a term the other did
// not — so this test reads both declarations and requires the bodies to agree.
// `this` and `self` are the same node in an MST view; a getter reaching a
// sibling declared in its own block has to say `this`.
//
// `dataSuperseded` is the one whose global-side copy sits a layer down, on
// `KeyedFetchMixin` — the keyed half of the global family, split out so the
// comparative foundation composes it too (ADR-105). Still one body against the
// per-region copy, and still read here.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const files = {
  MultiRegionDisplayMixin: 'MultiRegionDisplayMixin.ts',
  GlobalFetchMixin: 'GlobalFetchMixin.ts',
  KeyedFetchMixin: 'KeyedFetchMixin.ts',
}

const SHARED: [string, keyof typeof files][] = [
  ['host', 'GlobalFetchMixin'],
  ['viewportEmpty', 'GlobalFetchMixin'],
  ['canRender', 'GlobalFetchMixin'],
  ['dataSuperseded', 'KeyedFetchMixin'],
  ['paintInert', 'GlobalFetchMixin'],
  ['svgReady', 'GlobalFetchMixin'],
]

function bodyFrom(source: string, open: number) {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') {
      depth++
    } else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        return source.slice(open + 1, i)
      }
    }
  }
  throw new Error('unbalanced braces')
}

function getterBody(source: string, name: string) {
  const match = new RegExp(`^\\s*get ${name}\\(\\)[^{]*\\{`, 'm').exec(source)
  if (!match) {
    throw new Error(`no getter ${name}`)
  }
  return bodyFrom(source, match.index + match[0].length - 1)
    .replaceAll(/\/\/[^\n]*/g, '')
    .replaceAll(/\bthis\b/g, 'self')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

const sources = Object.fromEntries(
  Object.entries(files).map(([name, file]) => [
    name,
    readFileSync(path.join(__dirname, file), 'utf8'),
  ]),
) as Record<keyof typeof files, string>

test.each(SHARED)(
  'both foundations declare %s over one body',
  (name, globalSide) => {
    expect(getterBody(sources[globalSide], name)).toBe(
      getterBody(sources.MultiRegionDisplayMixin, name),
    )
  },
)

test('both foundations map displayPhase through foundationDisplayPhase, differing only in the staleness argument', () => {
  for (const source of [
    sources.MultiRegionDisplayMixin,
    sources.GlobalFetchMixin,
  ]) {
    const body = getterBody(source, 'displayPhase')
    expect(body).toMatch(
      /^return foundationDisplayPhase\( self, \(\) => .*, \(\) => self\.host\.effectiveBodyMounted, \)$/,
    )
  }
})
