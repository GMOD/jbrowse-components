import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// The boundary `components/overlayGeometry.ts` documents, as a test.
//
// model.ts is now itself lazily loaded (the ViewType registers a stateModel
// loader), so the boundary this pins is no longer eager-vs-lazy but
// chunk-vs-chunk: model.ts and its static imports form the state-model chunk,
// `components/` a separate one behind the ReactComponent lazy(). A React-free
// module imported by BOTH sides gets grouped with one of them, and the other
// side's import then drags that whole chunk — the eight overlay components and
// @floating-ui behind BreakpointTooltip — in alongside a load that only needed
// the helper. The state-model chunk also still loads well before components
// (session hydration vs first render), so the merge costs real bytes early.
//
// This is not hypothetical and it is not obvious from a diff, which is why it is
// pinned here. A duplication sweep (24aba4d012) read the four small helpers
// overlayGeometry.ts deliberately duplicates as accidental copies and pointed
// three of them at ../util.ts instead. Nothing failed: tsc passed, every suite
// passed, and the only signal was `pnpm smoke` in the build-your-own examples
// site, which needs a full Astro build to say anything. Measured there, the
// synteny page went 678 KB -> 690 KB gzip eager and broke its committed budget.
//
// So: the cost of keeping these few lines duplicated is a few lines. The cost of
// sharing them is 12 KB gzip on every page that loads the plugin. If a helper
// here really does need to be shared, move it OUT of ../util.ts to a third
// module that model.ts does not import — do not point components/ at ../util.ts.
const dir = path.join(__dirname, 'components')

// only static `import ... from` / `export ... from`; a dynamic import() is the
// whole escape hatch and is deliberately allowed
const STATIC_FROM = /^\s*(?:import|export)\b[^(]*?\sfrom\s+'([^']+)'/gm

test('nothing under components/ statically imports the eager side', () => {
  const offenders = []
  for (const file of readdirSync(dir).filter(
    f => /\.tsx?$/.test(f) && !f.includes('.test.'),
  )) {
    const text = readFileSync(path.join(dir, file), 'utf8')
    for (const m of text.matchAll(STATIC_FROM)) {
      const spec = m[1]!
      // types are erased at build time, so a type-only import costs nothing
      if (/^\s*import\s+type\b/.test(m[0])) {
        continue
      }
      if (spec === '../util.ts' || spec === '../model.ts') {
        offenders.push(`${file} -> ${spec}`)
      }
    }
  }
  expect(offenders).toEqual([])
})
