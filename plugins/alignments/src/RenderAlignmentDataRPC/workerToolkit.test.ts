/**
 * The RPC worker must not reach Material UI.
 *
 * `@jbrowse/core/ui/theme` re-exports every plain color constant this plugin
 * packs into vertex data, and it imports `createTheme`, so importing one color
 * through it drags the toolkit into the worker bundle. `@jbrowse/core/ui/palette`
 * exports the same values and imports no toolkit at all — measured on this
 * entry, the difference was 791 `@mui` files in the module graph (98.3kB
 * minified / 33.4kB gzip against 93.6 / 31.7 with esbuild, which tree-shakes
 * harder than the app's bundler does).
 *
 * Nothing about the wrong import looks wrong: it type-checks, it resolves to
 * the identical string, and the only symptom is a bigger worker chunk. So walk
 * the graph instead. Value imports only — `import type` is erased.
 */
import { readFileSync } from 'fs'
import path from 'path'

// `@jbrowse/core/ui` is the barrel of ~80 Material components and `ui/theme` is
// the entry that builds the MUI theme; a worker wanting a color has `ui/palette`
// for both. React and emotion are here because a component reached from this
// entry means the worker is importing the main thread's code by accident.
const forbidden =
  /^(react|react-dom|@mui\/|@emotion\/|@jbrowse\/core\/ui\/theme$|@jbrowse\/core\/ui$)/

function valueImports(file: string) {
  return [
    ...readFileSync(file, 'utf8').matchAll(
      /^(?:import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm,
    ),
  ]
    .filter(m => !m[1])
    .map(m => m[2]!)
}

function reach(entry: string) {
  const seen = new Set<string>()
  const bare = new Map<string, string[]>()
  const walk = (file: string, trail: string[]) => {
    if (seen.has(file)) {
      return
    }
    seen.add(file)
    for (const spec of valueImports(file)) {
      if (spec.startsWith('.')) {
        walk(path.join(path.dirname(file), spec), [...trail, spec])
      } else if (!bare.has(spec)) {
        bare.set(spec, [...trail, spec])
      }
    }
  }
  walk(entry, [path.basename(entry)])
  return bare
}

test('the alignments RPC entry reaches no toolkit', () => {
  const bare = reach(path.join(__dirname, 'executeRenderAlignmentData.ts'))
  // the trail is the diagnostic: "the worker pulls MUI" is unactionable,
  // "via ../features/modification/extract.ts -> @jbrowse/core/ui/theme" is a
  // one-line fix
  expect(
    [...bare]
      .filter(([spec]) => forbidden.test(spec))
      .map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

// The walk is only worth trusting if it can see a violation, and the display's
// React component is the exact negative case: it is the main-thread half of
// this same plugin and reaches the toolkit on purpose.
test('the walk would catch it (the display component does reach it)', () => {
  const bare = reach(
    path.join(
      __dirname,
      '..',
      'LinearAlignmentsDisplay',
      'components',
      'PileupComponent.tsx',
    ),
  )
  expect(
    [...bare.keys()].filter(s => forbidden.test(s)).length,
  ).toBeGreaterThan(0)
})
