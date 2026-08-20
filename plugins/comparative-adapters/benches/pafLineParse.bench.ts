// What do the tab-offset PAF parse and the spread-free feature build buy over
// the split-and-spread pair they replaced?
//
//   node --expose-gc plugins/comparative-adapters/benches/pafLineParse.bench.ts
//   node --expose-gc plugins/comparative-adapters/benches/pafLineParse.bench.ts --only=big
//   node --expose-gc plugins/comparative-adapters/benches/pafLineParse.bench.ts --rounds=40
//
// This is the read path of both in-memory PAF adapters and both indexed PIF
// adapters: one line of text in, one SyntenyFeature out, once per row of every
// fetch. There is nothing upstream of it to bin or cache — see ADR-039 — so the
// only lever here is the per-row cost itself.
//
// Read `agent-docs/reference/BENCHMARKING.md` first.
//
// ONE FIXTURE PER PROCESS, so `--only` is not a convenience. A bench that times
// the same arm objects on a second fixture contaminates it and every fixture
// after it; quote numbers from separate runs.
//
// FOUR ARMS, so each change can be read on its own:
//   split+spread   the pair this replaced
//   offsets        the tab-offset parse, old feature build
//   both           what ships
//   control        a second copy of split+spread
// The control is what this harness can resolve; a row whose control is far from
// 1.00 measured nothing.
//
// EVERY ARM OWNS ITS WHOLE PIPELINE, written out longhand, and the duplication
// is the entire point. The first version shared `parseSplit`/`featureSpread`
// between the baseline and the `offsets` arm, so the identity check called them
// twice per line against the control's once — and the control came back at
// 0.60x, i.e. the baseline looked 40% faster than an identical copy of itself
// purely from the extra warmup. That is the asymmetric-warmup trap in the
// catalogue, which reports it at 0.61x. Only the `both` arm reaches imported
// code, because that arm IS the shipped path.
//
// THE CONSUMER DOES NOT RETAIN THE FEATURES. An earlier shape pushed them into
// an array, and the arms' own garbage dominated: three byte-identical arms
// scored 1.00x, 0.94x and 1.38x, so nothing below ±40% was resolvable. Building
// and dropping is also what the worker does — it reads the features into flat
// arrays and lets them go.
//
// ROW COUNT IS THE CEILING, and it is low: about 4,000 rows per arm. Past it the
// control falls off a cliff — 0.63x at 16,066 fine rows, 0.68x at 20,000 coarse
// rows, 0.79x at 8,000 — while the candidate arms keep reporting plausible,
// stable, wrong ratios. It is row count and not bytes: 4,000 fine rows (7.2 MB of
// text) resolve cleanly and 20,000 coarse rows (1.9 MB) do not. Whatever it is,
// it is a property of building this many spread-built feature objects per pass,
// so cut a big fixture down rather than raising `--rounds`, which does not help.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS, measured 2026-08-20 on a box under load from other agents (load
// average ~7 of 16 cores, all session). Ranges span every sample whose control
// landed in 0.98-1.05 — six on the first row, five on each of the others — and a
// sample outside that measured nothing and is not in them.
//
//   fixture                          offsets      both         control
//   minimap2, 1,000 rows, 10 tags    1.10-1.20x   1.62-1.78x   0.98-1.02x
//   fine PIF, 4,000 rows, ~1.8kB     1.15-1.41x   1.60-2.19x   0.99-1.05x
//   coarse PIF, 4,000 rows, 2 tags   1.11-1.58x   1.55-2.34x   0.99-1.05x
//
// **These are the spread actually observed, not a tightened quote.** A run on a
// quiet box should land inside them and probably near the top; publishing the
// narrow version would have made a re-run look like a regression, which it did
// on the first attempt at writing this table.
//
// What did not move: both changes helped on every sample, and `both` beat
// `offsets` on every sample but one — the coarse row where they crossed at
// 1.58/1.55. The feature build being the larger half is the surprise, since the
// parse is the half ADR-039's cost note was written about.
//
// The parse on its own, measured without building a feature at all, is 1.4-2.0x
// across the same three fixtures. That arm is not here because it would be a
// fifth pipeline to keep symmetric for a number this file's `offsets` row
// already implies.
//
// THE BIG FIXTURE IS NOT COMMITTED. It wants a eukaryote-scale PIF; the file
// behind `agent-docs/measurements/pif-tier-wire-bytes.json` is the one to use:
//
//   curl -O https://jbrowse.org/genomes/hs1_vs_mm39/hs1ToMm39.over.chain.pif.gz
//   bgzip -dc hs1ToMm39.over.chain.pif.gz | grep -m 4000 '^q' > fine.pif
//   PAF_BENCH_PATH=fine.pif node --expose-gc … --only=big
//
// Swap `'^q'` for `'^Q'` to take the coarse tier instead. Both are worth running:
// a coarse row is short and carries no CIGAR, so it prices the offset walk
// without the 1.8kB column that flatters it.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { csToCigar, pafIdentity } from '@jbrowse/cigar-utils'

import SyntenyFeature from '../src/SyntenyFeature/index.ts'
import { makeIndexedSyntenyFeature, parsePifLine } from '../src/util.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? 25,
)
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
const allowDiff = process.argv.includes('--allow-diff')

function loadFixture() {
  if (only === 'big') {
    const path = process.env.PAF_BENCH_PATH
    if (!path) {
      throw new Error('--only=big wants PAF_BENCH_PATH — see the header')
    }
    return { label: `big (${path})`, text: readFileSync(path, 'utf8') }
  }
  const repoRoot = new URL('../../../', import.meta.url).pathname
  return {
    label: 'minimap2 (peach_grape_small_cigar)',
    text: gunzipSync(
      readFileSync(`${repoRoot}test_data/peach_grape_small_cigar.paf.gz`),
    ).toString('utf8'),
  }
}

const { label, text } = loadFixture()
const lines = text.split('\n').filter(Boolean)

// See ROW COUNT IS THE CEILING in the header. Loud, because the failure is a
// confident wrong answer: the arms stay in the same order and only the control
// gives it away.
const ROW_CEILING = 6000
if (lines.length > ROW_CEILING) {
  console.log(
    `WARNING: ${lines.length} rows is past this harness's ceiling of ~${ROW_CEILING}.\n` +
      '         Expect a control around 0.6-0.8x, which means the run measured\n' +
      '         nothing. Cut the fixture down and run it again.\n',
  )
}

// A parsed row, in the shape `parsePifLine` returns. Every arm's parse builds
// this exact literal so no arm pays for a shape the others don't.
interface Row {
  indexedName: string
  indexedRefName: string
  indexedStart: number
  indexedEnd: number
  mateName: string
  mateStart: number
  mateEnd: number
  strand: number
  extra: Record<string, string | number>
}

const mateOf = (row: Row) => ({
  start: row.mateStart,
  end: row.mateEnd,
  refName: row.mateName,
  assemblyName: 'other',
})

// ---------------------------------------------------------------------------
// arm 1 — split parse, mid-literal spread. The pair this replaced.

function parseSplitA(line: string): Row {
  const parts = line.split('\t')
  const extra: Record<string, string | number> = {
    numMatches: +parts[9]!,
    blockLen: +parts[10]!,
    mappingQual: +parts[11]!,
  }
  for (let i = 12; i < parts.length; i++) {
    const field = parts[i]!
    const colonIndex = field.indexOf(':')
    if (colonIndex !== -1) {
      extra[field.slice(0, colonIndex)] = field.slice(colonIndex + 3)
    }
  }
  return {
    indexedName: parts[0]!,
    indexedRefName: parts[0]!.slice(1),
    indexedStart: +parts[2]!,
    indexedEnd: +parts[3]!,
    mateName: parts[5]!,
    mateStart: +parts[7]!,
    mateEnd: +parts[8]!,
    strand: parts[4] === '-' ? -1 : 1,
    extra,
  }
}

function featureSpreadA(row: Row, offset: number) {
  const { extra, strand, indexedStart, indexedEnd } = row
  const { numMatches = 0, blockLen = 1, cg, cs, id: _id, ...rest } = extra
  const CIGAR =
    typeof cg === 'string'
      ? cg
      : typeof cs === 'string'
        ? csToCigar(cs)
        : undefined
  return new SyntenyFeature({
    uniqueId: `${offset}asm`,
    assemblyName: 'asm',
    start: indexedStart,
    end: indexedEnd,
    type: 'match',
    refName: row.indexedRefName,
    strand,
    ...rest,
    CIGAR,
    cs: typeof cs === 'string' ? cs : undefined,
    syntenyId: offset,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate: mateOf(row),
  })
}

// ---------------------------------------------------------------------------
// arm 2 — tab-offset parse, old feature build. Both written out again.

function columnNumB(s: string, from: number, to: number) {
  if (to <= from) {
    return Number.NaN
  }
  let n = 0
  for (let i = from; i < to; i++) {
    const digit = s.charCodeAt(i) - 48
    if (digit < 0 || digit > 9) {
      return Number(s.slice(from, to))
    }
    n = n * 10 + digit
  }
  return n
}

function parseOffsetsB(line: string): Row {
  const len = line.length
  const t0 = line.indexOf('\t')
  const t1 = line.indexOf('\t', t0 + 1)
  const t2 = line.indexOf('\t', t1 + 1)
  const t3 = line.indexOf('\t', t2 + 1)
  const t4 = line.indexOf('\t', t3 + 1)
  const t5 = line.indexOf('\t', t4 + 1)
  const t6 = line.indexOf('\t', t5 + 1)
  const t7 = line.indexOf('\t', t6 + 1)
  const t8 = line.indexOf('\t', t7 + 1)
  const t9 = line.indexOf('\t', t8 + 1)
  const t10 = line.indexOf('\t', t9 + 1)
  if (
    !(
      t0 < t1 &&
      t1 < t2 &&
      t2 < t3 &&
      t3 < t4 &&
      t4 < t5 &&
      t5 < t6 &&
      t6 < t7 &&
      t7 < t8 &&
      t8 < t9 &&
      t9 < t10
    )
  ) {
    return parseSplitA(line)
  }
  let t11 = line.indexOf('\t', t10 + 1)
  if (t11 === -1) {
    t11 = len
  }
  const extra: Record<string, string | number> = {
    numMatches: columnNumB(line, t8 + 1, t9),
    blockLen: columnNumB(line, t9 + 1, t10),
    mappingQual: columnNumB(line, t10 + 1, t11),
  }
  let pos = t11 + 1
  while (pos < len) {
    let end = line.indexOf('\t', pos)
    if (end === -1) {
      end = len
    }
    const colon = line.indexOf(':', pos)
    if (colon !== -1 && colon < end) {
      extra[line.slice(pos, colon)] = line.slice(colon + 3, end)
    }
    pos = end + 1
  }
  const name = line.slice(0, t0)
  return {
    indexedName: name,
    indexedRefName: line.slice(1, t0),
    indexedStart: columnNumB(line, t1 + 1, t2),
    indexedEnd: columnNumB(line, t2 + 1, t3),
    mateName: line.slice(t4 + 1, t5),
    mateStart: columnNumB(line, t6 + 1, t7),
    mateEnd: columnNumB(line, t7 + 1, t8),
    strand: t4 - t3 === 2 && line.charCodeAt(t3 + 1) === 45 ? -1 : 1,
    extra,
  }
}

function featureSpreadB(row: Row, at: number) {
  const { extra, strand, indexedStart, indexedEnd } = row
  const { numMatches = 0, blockLen = 1, cg, cs, id: _drop, ...tail } = extra
  const cigar =
    typeof cg === 'string'
      ? cg
      : typeof cs === 'string'
        ? csToCigar(cs)
        : undefined
  return new SyntenyFeature({
    uniqueId: `${at}asm`,
    assemblyName: 'asm',
    start: indexedStart,
    end: indexedEnd,
    type: 'match',
    refName: row.indexedRefName,
    strand,
    ...tail,
    CIGAR: cigar,
    cs: typeof cs === 'string' ? cs : undefined,
    syntenyId: at,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate: mateOf(row),
  })
}

// ---------------------------------------------------------------------------
// arm 3 — what ships. The only arm that reaches imported code.

function featureShipped(row: ReturnType<typeof parsePifLine>, offset: number) {
  return makeIndexedSyntenyFeature({
    line: row,
    fileOffset: offset,
    assemblyName: 'asm',
    refName: row.indexedRefName,
    mate: {
      start: row.mateStart,
      end: row.mateEnd,
      refName: row.mateName,
      assemblyName: 'other',
    },
  })
}

// ---------------------------------------------------------------------------
// arm 4 — the control: arm 1 declared a third time, for its own inline caches.

function parseSplitC(row: string): Row {
  const cols = row.split('\t')
  const tags: Record<string, string | number> = {
    numMatches: +cols[9]!,
    blockLen: +cols[10]!,
    mappingQual: +cols[11]!,
  }
  for (let k = 12; k < cols.length; k++) {
    const col = cols[k]!
    const c = col.indexOf(':')
    if (c !== -1) {
      tags[col.slice(0, c)] = col.slice(c + 3)
    }
  }
  return {
    indexedName: cols[0]!,
    indexedRefName: cols[0]!.slice(1),
    indexedStart: +cols[2]!,
    indexedEnd: +cols[3]!,
    mateName: cols[5]!,
    mateStart: +cols[7]!,
    mateEnd: +cols[8]!,
    strand: cols[4] === '-' ? -1 : 1,
    extra: tags,
  }
}

function featureSpreadC(rec: Row, idx: number) {
  const { extra, strand, indexedStart, indexedEnd } = rec
  const { numMatches = 0, blockLen = 1, cg, cs, id: _unused, ...others } = extra
  const alignment =
    typeof cg === 'string'
      ? cg
      : typeof cs === 'string'
        ? csToCigar(cs)
        : undefined
  return new SyntenyFeature({
    uniqueId: `${idx}asm`,
    assemblyName: 'asm',
    start: indexedStart,
    end: indexedEnd,
    type: 'match',
    refName: rec.indexedRefName,
    strand,
    ...others,
    CIGAR: alignment,
    cs: typeof cs === 'string' ? cs : undefined,
    syntenyId: idx,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate: mateOf(rec),
  })
}

// ---------------------------------------------------------------------------
// Identity, every arm against arm 1, over every line — and each arm's own
// functions called exactly once per line, which is what keeps the warmup even.
//
// Compared key-sorted: the arms differ in the ORDER the optional tags sit in the
// data object, deliberately (see copyPafTags), and nothing downstream of a
// feature reads its data by position.
function normalize(f: { toJSON: () => SimpleFeatureSerialized }) {
  const json = f.toJSON()
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(json)
        .sort()
        .map(k => [k, json[k]]),
    ),
  )
}

let diffs = 0
for (const [i, line] of lines.entries()) {
  const want = normalize(featureSpreadA(parseSplitA(line), i))
  const got = [
    ['offsets', normalize(featureSpreadB(parseOffsetsB(line), i))],
    ['both', normalize(featureShipped(parsePifLine(line), i))],
    ['control', normalize(featureSpreadC(parseSplitC(line), i))],
  ] as const
  for (const [name, value] of got) {
    if (value !== want && diffs++ < 3) {
      console.log(`DIFF ${name} at line ${i}\n  want ${want}\n  got  ${value}`)
    }
  }
}
if (diffs > 0 && !allowDiff) {
  throw new Error(`${diffs} arms disagree — pass --allow-diff if intended`)
}

// ---------------------------------------------------------------------------
// Arms rotate per round and the min is reported. The previous arm's output is
// released before the gc, so no arm's timing carries another's collection.

const arms = [
  [
    'split+spread',
    () => {
      let acc = 0
      for (const [i, line] of lines.entries()) {
        acc += featureSpreadA(parseSplitA(line), i).get('start')
      }
      return acc
    },
  ],
  [
    'offsets',
    () => {
      let acc = 0
      for (const [i, line] of lines.entries()) {
        acc += featureSpreadB(parseOffsetsB(line), i).get('start')
      }
      return acc
    },
  ],
  [
    'both (ships)',
    () => {
      let acc = 0
      for (const [i, line] of lines.entries()) {
        acc += featureShipped(parsePifLine(line), i).get('start')
      }
      return acc
    },
  ],
  [
    'control',
    () => {
      let acc = 0
      for (const [i, line] of lines.entries()) {
        acc += featureSpreadC(parseSplitC(line), i).get('start')
      }
      return acc
    },
  ],
] as const

const best = new Map(arms.map(([name]) => [name, Number.POSITIVE_INFINITY]))
let sink: unknown
for (let round = 0; round < rounds; round++) {
  for (let i = 0; i < arms.length; i++) {
    const [name, run] = arms[(round + i) % arms.length]!
    sink = undefined
    globalThis.gc?.()
    const t = performance.now()
    sink = run()
    best.set(name, Math.min(best.get(name)!, performance.now() - t))
  }
}
void sink

console.log(`${label} — ${lines.length} rows, min of ${rounds} rounds`)
const baseline = best.get('split+spread')!
for (const [name, ms] of best) {
  console.log(
    `  ${name.padEnd(14)} ${ms.toFixed(2)} ms   ${(baseline / ms).toFixed(3)}x`,
  )
}
