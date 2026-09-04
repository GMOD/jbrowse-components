// No display outside the foundations overrides `displayPhase` or `svgReady`
// over the LGV mapping.
//
// `computeDisplayPhase` single-sources the precedence and `computeLoadingTerm`
// the loading expression, and `foundationDisplayPhase` is the one place the
// foundations' field names are mapped onto both. A plugin getter that
// post-processes has restated the foundation's arguments to append one term —
// which is the shape DISPLAYCHROME.md forbids, because the copy silently misses
// the next term added to the mapping. Multi-way synteny shipped in that shape to
// say "my lane fetches have not first landed"; that is
// `FetchMixin.awaitingDependentData` now, the way "I never fetch here" is
// `fetchInert`. The density tier's swap did too, once per display, and one copy
// dropped `staleSettingsDrawn`; it is `DensityTierMixin`'s getter now. A display
// with a new term adds a hook beside those, or a mixin in display-kit.
//
// The legitimate declarations are the displays that compose no LGV foundation,
// and they are told apart by the entry they map through: arc narrows to the
// backend-free `DisplayStatusPhase` via `foundationDisplayStatusPhase`, chord
// writes `computeDisplayStatusPhase` / `computeSvgReady` itself, and the
// comparative family declares its own over `comparativeDisplayPhase` /
// `comparativeSurfacePhase`. A body calling anything else — a wrapper included —
// is an override, wherever the wrapper lives.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')

function pluginSources() {
  return execFileSync(
    'git',
    ['ls-files', 'plugins/**/*.ts', 'plugins/**/*.tsx'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter(file => file && !file.includes('.test.'))
}

function bodyFrom(source: string, open: number) {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') {
      depth++
    } else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        return source.slice(open, i + 1)
      }
    }
  }
  throw new Error('unbalanced braces')
}

function withoutComments(body: string) {
  return body.replaceAll(/\/\/[^\n]*/g, '').replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

const GETTERS = {
  displayPhase: [
    'foundationDisplayStatusPhase',
    'computeDisplayStatusPhase',
    'comparativeDisplayPhase',
    'comparativeSurfacePhase',
  ],
  svgReady: ['computeSvgReady'],
}

test('no plugin declares displayPhase or svgReady over an LGV foundation', () => {
  const offenders: string[] = []
  for (const file of pluginSources()) {
    const source = readFileSync(path.join(root, file), 'utf8')
    for (const [name, entries] of Object.entries(GETTERS)) {
      const declared = new RegExp(`^\\s*get ${name}\\(\\)[^{]*\\{`, 'gm')
      for (const match of source.matchAll(declared)) {
        const body = withoutComments(
          bodyFrom(source, match.index + match[0].length - 1),
        )
        if (!entries.some(entry => body.includes(`${entry}(`))) {
          const line = source.slice(0, match.index).split('\n').length
          offenders.push(`${file}:${line} ${name}`)
        }
      }
    }
  }
  expect(offenders).toEqual([])
})
