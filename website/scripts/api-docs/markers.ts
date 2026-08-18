// Every marker-block table, in one process.
//
//   node website/scripts/api-docs/markers.ts            rewrite them all
//   node website/scripts/api-docs/markers.ts --check    verify (what CI runs)
//   node website/scripts/api-docs/markers.ts --check color
//                                                       limit by label substring
//
// This is one `pnpm autogen` entry standing in for the ten the marker
// generators used to have; markerGenerators.ts says why. The filter is the same
// idea as autogen's own, one level down, so narrowing to a single table during
// development did not have to be given up along with the per-file CLIs.
//
// Every generator runs before anything exits, and each is reported by name.
// Stopping at the first stale table would put back the fix-push-discover-the-
// next loop that scripts/autogen.ts exists to end — and these ten are exactly
// the case where it bites, since one source edit routinely staleness two of
// them at once (a `#color` tag renders into both a guide and the spec).
import { MARKER_GENERATORS } from './markerGenerators.ts'
import { assertMarkersAndDocsAgree, getAllFiles, sourceCorpus } from './util.ts'

const args = process.argv.slice(2)
const check = args.includes('--check')
const filters = args.filter(a => !a.startsWith('--'))

const selected = filters.length
  ? MARKER_GENERATORS.filter(g =>
      filters.some(f => g.label.toLowerCase().includes(f.toLowerCase())),
    )
  : MARKER_GENERATORS

if (!selected.length) {
  console.error(
    `no marker generator matches ${filters.join(', ')} — labels are:\n${MARKER_GENERATORS.map(
      g => `  ${g.label}`,
    ).join('\n')}`,
  )
  process.exit(1)
}

const corpus = sourceCorpus(await getAllFiles())
const stale = new Map<string, string[]>()

for (const { label, write } of selected) {
  const docs = write(corpus, { check })
  if (docs.length) {
    stale.set(label, docs)
  }
  console.log(
    `${label}: ${docs.length ? `${docs.length} stale` : 'up to date'}`,
  )
}

// Only the generated-but-rendered-nowhere half: this run invokes 22 of the
// generators, so a marker pair it never wrote is not evidence that nothing
// writes it. `generate.ts` runs them all and checks both directions.
try {
  assertMarkersAndDocsAgree({ both: false })
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`)
  process.exit(1)
}

if (stale.size) {
  console.error(
    `\n${stale.size} marker table(s) out of date — run \`pnpm autogen\`:\n${[
      ...stale,
    ]
      .map(([label, docs]) =>
        [`  ${label}`, ...docs.map(d => `    ${d}`)].join('\n'),
      )
      .join('\n')}`,
  )
  process.exit(1)
}
