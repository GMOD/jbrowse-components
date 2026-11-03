// Every marker-block table, in one process.
//
//   node website/scripts/api-docs/markers.ts            rewrite them all
//   node website/scripts/api-docs/markers.ts --check    verify (what CI runs)
//   node website/scripts/api-docs/markers.ts --check color
//                                                       limit by label substring
//
// This is one `pnpm autogen` entry standing in for the one-per-generator
// entries the marker generators used to have; markerGenerators.ts says why. The
// filter is the same idea as autogen's own, one level down, so narrowing to a
// single table during development did not have to be given up along with the
// per-file CLIs.
//
// Every generator runs before anything exits, and each is reported by name.
// Stopping at the first stale table would put back the fix-push-discover-the-
// next loop that scripts/autogen.ts exists to end — and these are exactly the
// case where it bites, since one source edit routinely staleness two of them at
// once (a `#color` tag renders into both a guide and the spec).
import { flushDocs, staleDocs } from './format.ts'
import { MARKER_GENERATORS, PROGRAM_MARKERS } from './markerGenerators.ts'
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
// A generator that throws is reported under its label and the rest still run,
// for the same reason no stale table stops the run.
const failed = new Map<string, unknown>()
const touched = selected.map(({ label, write }) => {
  try {
    return { label, docs: [...new Set(write(corpus))] }
  } catch (e) {
    failed.set(label, e)
    return { label, docs: [] }
  }
})
// The raw splice differs from the committed doc whenever the formatter would
// reflow the block, so a doc counts as stale only if it still differs once
// formatted, the way the write run below commits it.
const differs = new Set(check ? staleDocs() : [])
const stale = new Map<string, string[]>()
for (const { label, docs } of touched) {
  const moved = check ? docs.filter(d => differs.has(d)) : docs
  if (check && moved.length) {
    stale.set(label, moved)
  }
  console.log(
    `${label}: ${moved.length ? `${moved.length} ${check ? 'stale' : 'rewritten'}` : 'up to date'}`,
  )
}

// Both directions on a whole run, the program's markers counted as written;
// only the generated-but-rendered-nowhere half on a filtered one, since a
// marker pair it never wrote is not evidence that nothing writes it.
for (const [label, e] of failed) {
  console.error(`\n${label} failed:\n${e instanceof Error ? e.message : e}`)
}
try {
  assertMarkersAndDocsAgree({
    both: !filters.length,
    writtenElsewhere: PROGRAM_MARKERS,
  })
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`)
  process.exit(1)
}
if (failed.size) {
  process.exit(1)
}
if (!check) {
  await flushDocs()
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
