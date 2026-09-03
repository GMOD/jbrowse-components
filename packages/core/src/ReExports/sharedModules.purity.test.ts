import { readFileSync } from 'node:fs'
import path from 'node:path'

// `sharedModules.ts` is the half of the plugin ABI the RPC worker publishes for
// real, so its static graph is what a worker downloads before a UMD plugin can
// evaluate. Keeping react-dom out of it is the whole of the 272 -> 182 KB in
// EAGER_BUNDLE.md's worker section, and it is not a property anyone can see by
// reading the file: it went wrong through `util/index.ts` re-exporting
// `renderToStaticMarkup`, two hops away, which mounts a client root.
//
// react only. react itself is shared (a plugin's components are the host's
// elements), and @mui rides along with `ui/theme.ts`, which renderers read.
const forbidden = /^react-dom(\/|$)/

// `export … from` counts as much as `import … from`: the util barrel is made of
// them, and that is the edge this exists to catch.
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

test('the worker half of the ABI reaches no react-dom', () => {
  const bare = reach(path.join(__dirname, 'sharedModules.ts'))
  const offenders = [...bare].filter(([spec]) => forbidden.test(spec))
  // the trail is the whole diagnostic: "sharedModules pulls react-dom" is
  // unactionable, "via ./publicUtil.ts -> ../util/index.ts" is a fix
  expect(
    offenders.map(([spec, trail]) => `${spec} via ${trail.join(' -> ')}`),
  ).toEqual([])
})

// A tracer that cannot see a violation is worth nothing. modules.ts is the same
// map with the main thread's UI on top, so it is the exact negative control.
test('the tracer would catch it (the main-thread map it is a subset of fails)', () => {
  const bare = reach(path.join(__dirname, 'modules.ts'))
  expect(
    [...bare.keys()].filter(spec => forbidden.test(spec)).length,
  ).toBeGreaterThan(0)
})
