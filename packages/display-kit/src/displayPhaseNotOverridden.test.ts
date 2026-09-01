// No display outside the foundations overrides `displayPhase` over the LGV
// mapping.
//
// `computeDisplayPhase` single-sources the precedence and `computeLoadingTerm`
// the loading expression, and `foundationDisplayPhase` is the one place the
// foundations' field names are mapped onto both. A plugin getter that calls it
// and then post-processes has restated the foundation's arguments to append one
// term — which is the shape DISPLAYCHROME.md forbids, because the copy silently
// misses the next term added to the mapping. Multi-way synteny shipped in that
// shape to say "my lane fetches have not first landed"; that is
// `FetchMixin.awaitingDependentData` now, the way "I never fetch here" is
// `fetchInert`. A display with a new term adds a hook beside those two.
//
// Two declarations are legitimate and are told apart by what they call: arc's
// narrows the same mapping to the backend-free `DisplayStatusPhase` through
// `foundationDisplayStatusPhase`, and the comparative family composes no LGV
// foundation and declares its own over `comparativeDisplayPhase`. Neither
// reaches `foundationDisplayPhase` or `computeDisplayPhase`, so those two names
// are the test.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')

// The density tier's override, in flight while this test landed: it re-ranks
// `tooLarge` to `ready`/`loading` while a density source serves the view. The
// hook shape for it is two of the existing kind — a `RegionTooLargeMixin` hook
// that keeps the verdict out of the phase while a tier answers it, and
// `awaitingDependentData` for the bins' first landing — and this entry goes
// when the override does.
const IN_FLIGHT = new Set([
  'plugins/alignments/src/LinearAlignmentsDisplay/model.ts',
])

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

test('no plugin displayPhase getter post-processes the LGV mapping', () => {
  const offenders: string[] = []
  for (const file of pluginSources().filter(f => !IN_FLIGHT.has(f))) {
    const source = readFileSync(path.join(root, file), 'utf8')
    for (const match of source.matchAll(/^\s*get displayPhase\(\)[^{]*\{/gm)) {
      const body = withoutComments(
        bodyFrom(source, match.index + match[0].length - 1),
      )
      if (/\b(?:foundationDisplayPhase|computeDisplayPhase)\(/.test(body)) {
        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${file}:${line}`)
      }
    }
  }
  expect(offenders).toEqual([])
})
