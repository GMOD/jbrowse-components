import { readFileSync } from 'fs'
import path from 'path'

// `ui/menuItems.ts` exists so that eagerly-evaluated code — state models, the
// `menuItems`/`trackMenus` modules of a dozen plugins — can build menu rows
// without reaching the `@jbrowse/core/ui` barrel, which re-exports ~80 Material
// UI components. The whole value of the split is that the entry stays free of
// React, MUI and emotion, and that is not a property anyone can see by reading
// the file: it went wrong through `promotableMenuItems`, one hop away, which
// rendered a pin element into the descriptor it returned.
//
// So walk the graph. Value imports only — `import type` is erased and a type
// from a React module costs nothing — resolved relative-path by relative-path,
// which is all this subtree uses.
const forbidden = /^(react|react-dom|@mui\/|@emotion\/)/

// `export … from` counts as much as `import … from`: a barrel is made of them,
// and missing them is why the first version of this tracer passed the negative
// control below.
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

test('the menu-item entry reaches no React, MUI or emotion', () => {
  const bare = reach(path.join(__dirname, 'menuItems.ts'))
  const offenders = [...bare].filter(([spec]) => forbidden.test(spec))
  // the trail is the whole diagnostic — "menuItems.ts pulls MUI" is unactionable,
  // "via ./promotableMenuItems.ts -> ./DefaultForAllAdornment.tsx" is a fix
  expect(
    offenders.map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

// The tracer is only worth trusting if it can see a violation, and the one it
// exists to catch is transitive rather than direct. `ui/index.ts` is the barrel
// menuItems.ts was split out of, so it is the exact negative case.
test('the tracer would catch it (the barrel it was split from fails)', () => {
  const bare = reach(path.join(__dirname, 'index.ts'))
  expect(
    [...bare.keys()].filter(spec => forbidden.test(spec)).length,
  ).toBeGreaterThan(0)
})
