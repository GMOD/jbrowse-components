// A BED line through what BedTabixAdapter's line callback does with it — split,
// featureData, SimpleFeature — for production featureData against the one it
// replaced (featureDataOld.ts) and a byte-identical copy of that
// (featureDataControl.ts).
//
//   node plugins/bed/benches/featureData.bench.ts --only=<file.bed> [--scoreColumn=x] [--point] [--rounds=9]
//
// `--point` reads column 2 as a 1-based position, as a GWAS file's tabix
// index does. One fixture per process (BENCHMARKING.md, "Looping several
// DATASETS"), in 4,000-line windows so the arms' garbage does not decide the
// result, arms rotated within each window, MIN across rounds of the whole
// sweep. Every line is compared across the arms as serialized features, key
// order included, before any time is believed, and the rows each path took
// are counted.
//
// On ada, 2026-09-24, two sittings, 40,000 lines each (peaks 14,901), control
// 0.98-1.02x: hs1 RepeatMasker 1.57-1.65x, GIANT GWAS 1.17-1.23x, HPRC genes
// BED12 1.13-1.14x, ENCODE peaks 1.08-1.11x, modkit bedMethyl 1.07x.
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import * as cur from '../src/util.ts'
import * as ctl from './featureDataControl.ts'
import * as old from './featureDataOld.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const file = flag('only')!
const scoreColumn = flag('scoreColumn') ?? ''
const point = process.argv.includes('--point')
const rounds = Number(flag('rounds') ?? 9)
const WINDOW = 4000
const MAX_LINES = Number(flag('lines') ?? 40_000)

const all = readFileSync(file, 'utf8').split('\n').filter(Boolean)
const header = all.filter(l => l.startsWith('#'))
const lines = all.filter(l => !l.startsWith('#')).slice(0, MAX_LINES)
const names = cur.parseNamesFromHeader(header.join('\n'))
const oldParser = cur.makeParser({ columnNames: names })
const ctlParser = cur.makeParser({ columnNames: names })
const curParser = cur.makeParser({ columnNames: names })

function locusOf(splitLine: string[]) {
  const a = +splitLine[1]!
  return point ? { start: a - 1, end: a } : { start: a, end: +splitLine[2]! }
}

// One driver per arm, written out rather than shared, so no call site goes
// polymorphic across arms.
function armOld(from: number, to: number) {
  let sum = 0
  for (let i = from; i < to; i++) {
    const splitLine = lines[i]!.split('\t')
    const { start, end } = locusOf(splitLine)
    const f = new SimpleFeature(
      old.featureData({
        splitLine,
        refName: splitLine[0]!,
        start,
        end,
        scoreColumn,
        parser: oldParser,
        uniqueId: `b-${i}`,
        names,
      }),
    )
    sum += f.get('end')
  }
  return sum
}
function armControl(from: number, to: number) {
  let sum = 0
  for (let i = from; i < to; i++) {
    const splitLine = lines[i]!.split('\t')
    const { start, end } = locusOf(splitLine)
    const f = new SimpleFeature(
      ctl.featureData({
        splitLine,
        refName: splitLine[0]!,
        start,
        end,
        scoreColumn,
        parser: ctlParser,
        uniqueId: `b-${i}`,
        names,
      }),
    )
    sum += f.get('end')
  }
  return sum
}
function armCurrent(from: number, to: number) {
  let sum = 0
  for (let i = from; i < to; i++) {
    const splitLine = lines[i]!.split('\t')
    const { start, end } = locusOf(splitLine)
    const f = new SimpleFeature(
      cur.featureData({
        splitLine,
        refName: splitLine[0]!,
        start,
        end,
        scoreColumn,
        parser: curParser,
        uniqueId: `b-${i}`,
        names,
      }),
    )
    sum += f.get('end')
  }
  return sum
}

function serialized(
  fd: typeof cur.featureData,
  parser: ReturnType<typeof cur.makeParser>,
  i: number,
) {
  const splitLine = lines[i]!.split('\t')
  const f = new SimpleFeature(
    fd({
      splitLine,
      refName: splitLine[0]!,
      start: locusOf(splitLine).start,
      end: locusOf(splitLine).end,
      scoreColumn,
      parser,
      uniqueId: `b-${i}`,
      names,
    }),
  ).toJSON()
  const path =
    f.type ??
    (f.matching_repeat_class !== undefined
      ? 'repeat'
      : f.n_valid_cov !== undefined
        ? 'methyl'
        : 'plain')
  return { json: JSON.stringify(f), type: String(path) }
}

const types = new Map<string, number>()
let diffs = 0
for (let i = 0; i < lines.length; i++) {
  const a = serialized(old.featureData, oldParser, i)
  const c = serialized(ctl.featureData, ctlParser, i)
  const b = serialized(cur.featureData, curParser, i)
  types.set(a.type, (types.get(a.type) ?? 0) + 1)
  if (a.json !== b.json || a.json !== c.json) {
    if (diffs++ === 0) {
      console.log(
        `first difference, line ${i}:\n old ${a.json}\n new ${b.json}`,
      )
    }
  }
}
console.log(
  `${lines.length} lines, types ${JSON.stringify(Object.fromEntries(types))}, ${diffs} differ`,
)
if (diffs && !process.argv.includes('--allow-diff')) {
  process.exit(1)
}

const arms = [
  ['old', armOld],
  ['control', armControl],
  ['current', armCurrent],
] as const
const best = new Map<string, number>(arms.map(([n]) => [n, Infinity]))
let sink = 0
for (let r = 0; r < rounds; r++) {
  const total = new Map<string, number>(arms.map(([n]) => [n, 0]))
  for (let w = 0, k = 0; w < lines.length; w += WINDOW, k++) {
    const to = Math.min(w + WINDOW, lines.length)
    for (let j = 0; j < arms.length; j++) {
      const [name, run] = arms[(j + k + r) % arms.length]!
      const t0 = performance.now()
      sink += run(w, to)
      total.set(name, total.get(name)! + performance.now() - t0)
    }
  }
  for (const [n, t] of total) {
    best.set(n, Math.min(best.get(n)!, t))
  }
}
const base = best.get('old')!
for (const [n, t] of best) {
  console.log(
    `${n.padEnd(8)} ${t.toFixed(1).padStart(8)} ms  ${(base / t).toFixed(2)}x`,
  )
}
if (sink === 0) {
  console.log('')
}
