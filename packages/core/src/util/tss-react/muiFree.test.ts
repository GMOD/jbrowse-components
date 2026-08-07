import { readFileSync } from 'fs'
import path from 'path'

// `makeStyles` is imported by 268 modules, a great many of them evaluated when
// a plugin installs. For most of JBrowse's life the theme it handed them was
// Material UI's, fetched through a six-line `useTheme` shim — and that one
// import put `createTheme`, ~51 KB, into the first paint of every host,
// including an embedded one rendering a display that draws nothing Material at
// all. It is now JBrowse's own plain-data style theme (`ui/styleTheme.ts`).
//
// Nothing about a future diff would say so. A `theme.zIndex` added back to
// `JBrowseStyleTheme` by copying MUI's, an `alpha()` imported into
// PaletteContext for convenience, and the shim is back with no line to blame.
//
// React and emotion are fine here and are the point of the module — this is
// narrower than `ui/menuItems.purity.test.ts`, which forbids all three.
const isMui = (spec: string) => spec.startsWith('@mui/')

// `export … from` counts as much as `import … from`: a barrel is made of them.
// Value imports only — `import type` is erased.
function valueImports(file: string) {
  const source = readFileSync(file, 'utf8')
  return [
    ...source.matchAll(
      /^(?:import|export)\s+(type\s+)?([^;]*?)from\s+'([^']+)'/gm,
    ),
  ]
    .filter(m => !m[1])
    .map(m => m[3]!)
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

test('makeStyles reaches no Material UI', () => {
  const bare = reach(path.join(__dirname, 'index.ts'))
  const offenders = [...bare].filter(([spec]) => isMui(spec))
  // the trail is the whole diagnostic — "tss-react pulls MUI" is unactionable,
  // "via ../../ui/PaletteContext.tsx -> ./styleTheme.ts" is a fix
  expect(
    offenders.map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

test('the style theme itself reaches no Material UI', () => {
  const bare = reach(path.join(__dirname, '../../ui/styleTheme.ts'))
  expect([...bare.keys()].filter(spec => isMui(spec))).toEqual([])
})

// The tracer is only worth trusting if it can see a violation, and the one it
// exists to catch is transitive. `ui/theme.ts` is the module that legitimately
// builds the MUI theme, so it is the exact negative case.
test('the tracer would catch it (ui/theme.ts fails)', () => {
  const bare = reach(path.join(__dirname, '../../ui/theme.ts'))
  expect([...bare.keys()].filter(spec => isMui(spec)).length).toBeGreaterThan(0)
})
