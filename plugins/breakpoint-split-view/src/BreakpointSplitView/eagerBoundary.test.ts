import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// The boundary `components/overlayGeometry.ts` documents, as a test.
//
// model.ts is evaluated at plugin-registration time, so it and everything it
// statically imports are eager; `components/` is reached only through a lazy().
// A React-free module imported by BOTH sides gets grouped with the lazy chunk,
// and model.ts's eager import of it then drags the whole chunk — the eight
// overlay components and @floating-ui behind BreakpointTooltip — onto a page
// that never opens a breakpoint split view.
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
