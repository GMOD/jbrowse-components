// What does walking tab offsets buy over `line.split('\t')` in `parseBed`?
//
//   node plugins/comparative-adapters/benches/mcscanParseBed.bench.ts --only=grape
//   node plugins/comparative-adapters/benches/mcscanParseBed.bench.ts --only=peach
//   node plugins/comparative-adapters/benches/mcscanParseBed.bench.ts --rounds=15
//
// ONE FIXTURE PER PROCESS. Both BEDs in one run put the control at 1.06x on the
// first and 0.90x on the second, which is the arm-sharing-across-fixtures trap
// in the catalogue: the second fixture runs the same arm objects the first left
// polymorphic. Quote the numbers from `--only` runs.
//
// The default 25 rounds is what a 0.97-0.99x control needs on a shared box; at
// 7 the control wandered to 0.94-1.09x, which is wider than half the result.
// Measured 1.89-2.22x on grape's 55,564 rows against a control of 0.97-0.99x.
//
// The BED sidecars are the largest thing an MCScan track parses. jcvi's
// grape/peach pair ships 55,564 + 47,089 gene rows, and parsing them was 66% of
// the adapter's cold setup — the split allocated a six-element array and six
// substrings per row to keep four of them.
//
// Read `agent-docs/reference/BENCHMARKING.md` first.
//
// SEPARATE DRIVERS, WRITTEN OUT LONGHAND. `parseBedSplitA` and `parseBedSplitB`
// are two separately-written copies of the implementation this replaced, not one
// function called twice: a shared driver goes polymorphic and both arms pay for
// it. B is the control, and its ratio against A is this harness's floor.
//
// INTERNING IS NOT AN ARM, because it was tried and lost. A fourth arm that
// interned column 1 through a `Map<string, string>` — 33 distinct scaffolds over
// 55,564 rows — cost 28% (35.6ms -> 46.0ms) and saved no measurable heap. The
// strings it deduplicates are short enough that V8 allocates them flat, so there
// was nothing for a second reference to save.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { parseBed } from '../src/util.ts'

import type { BareFeature } from '../src/mcscanUtil.ts'

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? 25,
)
const allowDiff = process.argv.includes('--allow-diff')

const dir = new URL('../src/MCScanAnchorsAdapter/test_data/', import.meta.url)
  .pathname
const read = (name: string) =>
  gunzipSync(readFileSync(`${dir}${name}`)).toString('utf8')

// baseline: the split-based parse this replaced
function parseBedSplitA(text: string) {
  const result = new Map<string, BareFeature>()
  for (const line of text.split(/\n|\r\n|\r/)) {
    if (line && !line.startsWith('#')) {
      const [refName, start, end, name, score, strand] = line.split('\t')
      if (refName && start && end && name) {
        const numScore = Number(score)
        result.set(name, {
          refName,
          start: +start,
          end: +end,
          score: Number.isFinite(numScore) ? numScore : 0,
          name,
          strand: strand === '-' ? -1 : 1,
        })
      }
    }
  }
  return result
}

// control: the same code as the baseline, written out a second time so it gets
// its own inline caches. Whatever it scores against A is the harness's floor.
function parseBedSplitB(text: string) {
  const out = new Map<string, BareFeature>()
  for (const row of text.split(/\n|\r\n|\r/)) {
    if (row && !row.startsWith('#')) {
      const [chrom, from, to, id, sc, sense] = row.split('\t')
      if (chrom && from && to && id) {
        const scoreValue = Number(sc)
        out.set(id, {
          refName: chrom,
          start: +from,
          end: +to,
          score: Number.isFinite(scoreValue) ? scoreValue : 0,
          name: id,
          strand: sense === '-' ? -1 : 1,
        })
      }
    }
  }
  return out
}

function describeDiff(
  a: Map<string, BareFeature>,
  b: Map<string, BareFeature>,
) {
  if (a.size !== b.size) {
    return `row count ${a.size} vs ${b.size}`
  }
  for (const [key, left] of a) {
    const right = b.get(key)
    if (!right) {
      return `"${key}" missing`
    }
    for (const field of [
      'refName',
      'start',
      'end',
      'score',
      'name',
      'strand',
    ] as const) {
      if (left[field] !== right[field]) {
        return `"${key}".${field}: ${left[field]} vs ${right[field]}`
      }
    }
  }
  return undefined
}

const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
const files = ['grape.bed.gz', 'peach.bed.gz'].filter(
  f => only === undefined || f.startsWith(only),
)
if (files.length === 0) {
  throw new Error(`--only=${only} matches no fixture`)
}
if (files.length > 1) {
  console.log('two fixtures in one process — see the header, use --only\n')
}

for (const file of files) {
  const text = read(file)

  // warm every arm the same way, and check identity before believing any timing
  const expected = parseBedSplitA(text)
  const diffCandidate = describeDiff(expected, parseBed(text))
  const diffControl = describeDiff(expected, parseBedSplitB(text))
  if ((diffCandidate ?? diffControl) !== undefined) {
    const message = `${file}: candidate ${diffCandidate ?? 'ok'}, control ${diffControl ?? 'ok'}`
    if (!allowDiff) {
      throw new Error(`${message} (pass --allow-diff if deliberate)`)
    }
    console.log(`DIFF ${message}`)
  }

  let bestSplit = Number.POSITIVE_INFINITY
  let bestOffsets = Number.POSITIVE_INFINITY
  let bestControl = Number.POSITIVE_INFINITY
  for (let round = 0; round < rounds; round++) {
    let t = performance.now()
    parseBedSplitA(text)
    bestSplit = Math.min(bestSplit, performance.now() - t)

    t = performance.now()
    parseBed(text)
    bestOffsets = Math.min(bestOffsets, performance.now() - t)

    t = performance.now()
    parseBedSplitB(text)
    bestControl = Math.min(bestControl, performance.now() - t)
  }

  console.log(
    `${file} — ${expected.size} rows, ${text.length} chars\n` +
      `  split (baseline)  ${bestSplit.toFixed(2)}ms\n` +
      `  tab offsets       ${bestOffsets.toFixed(2)}ms  ${(bestSplit / bestOffsets).toFixed(2)}x\n` +
      `  split (control)   ${bestControl.toFixed(2)}ms  ${(bestSplit / bestControl).toFixed(2)}x`,
  )
}
