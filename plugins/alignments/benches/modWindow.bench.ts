// What cutting the modification marks to the fetched region saves, end to end
// over the worker's modification path: extract, arrays, per-base counts,
// modification coverage and the tooltip index.
//
//   node --expose-gc --experimental-transform-types plugins/alignments/benches/modWindow.bench.ts
//
// Flags: --rounds=<n> (default 15), --bam=<dir>, --refName, --widths=<a,b,..>
//
// Arms, interleaved per round, min of rounds: `window` is the shipped path;
// `whole` hands the extract a window spanning every read, which is what it did
// before; `control` is a separately written copy of `window`. Before timing,
// `window`'s marks are checked against `whole`'s cut to the region.
//
// 2026-09-24, `200x.longread.mod.bam` around chr22_mask:200,000, 15 rounds, at
// load 37-44 (the control drifts 1.1-1.2x from `window`, well under the effect):
//
//   width   reads  marks(window)  marks(whole)  window   whole  whole/window
//    1000     253          1,690       142,376   201 ms  554 ms   2.75x
//   10000     289         36,985       158,086   294 ms  773 ms   2.63x
//   50000     375        128,026       198,695   791 ms 1405 ms   1.78x
//
// What `window` has left at 1 kb is nearly all the extract (245 of 246 ms in
// the split this prints): the MM delta walk and the CIGAR walk still run over
// every read end to end, 12 Mbp here for 1,690 marks.
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { computeCoverage } from '@jbrowse/alignments-core'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import BamSlightlyLazyFeature from '../src/BamAdapter/BamSlightlyLazyFeature.ts'
import { computeModificationCoverage } from '../src/features/modCoverage/compute.ts'
import { computeReadBaseCounts } from '../src/features/modCoverage/readBaseCounts.ts'
import { buildModificationArrays } from '../src/features/modification/buildArrays.ts'
import { extractModifications } from '../src/features/modification/extract.ts'
import { buildModTooltipIndex } from '../src/shared/modTooltipIndex.ts'
import { getStrand } from '../src/shared/util.ts'

import type { ColorBy } from '../src/shared/types.ts'
import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'
import type { ModificationType } from '@jbrowse/modifications-utils'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '15'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const WIDTHS = arg('widths', '1000,10000,50000').split(',').map(Number)
const CENTER = Number(arg('center', '200000'))

const colorBy: ColorBy = {
  type: 'modifications',
  modifications: { threshold: 50 },
}
const WHOLE = { start: 0, end: Number.MAX_SAFE_INTEGER }

interface Window {
  start: number
  end: number
}

function extract(features: BamSlightlyLazyFeature[], window: Window) {
  const out: ModificationEntry[] = []
  const detected = new Set<string>()
  const seen = new Map<string, ModificationType>()
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    extractModifications(
      f,
      i,
      f.start,
      getStrand(f),
      window,
      colorBy,
      detected,
      seen,
      out,
    )
  }
  return out
}

function downstream(
  features: BamSlightlyLazyFeature[],
  mods: ModificationEntry[],
  coverage: ReturnType<typeof computeCoverage>,
  simplex: ReadonlySet<string>,
) {
  const arrays = buildModificationArrays(mods)
  const positions = new Set<number>()
  for (const m of mods) {
    positions.add(m.position)
  }
  const counts = computeReadBaseCounts(features, positions)
  const cov = computeModificationCoverage(mods, counts, coverage, simplex)
  const tooltip = buildModTooltipIndex(mods)
  return (
    arrays.modificationPositions.length +
    counts.size +
    cov.count +
    (tooltip?.modTooltipPositions.length ?? 0)
  )
}

function runWindow(
  features: BamSlightlyLazyFeature[],
  region: Window,
  coverage: ReturnType<typeof computeCoverage>,
  simplex: ReadonlySet<string>,
) {
  return downstream(features, extract(features, region), coverage, simplex)
}

function runWhole(
  features: BamSlightlyLazyFeature[],
  _region: Window,
  coverage: ReturnType<typeof computeCoverage>,
  simplex: ReadonlySet<string>,
) {
  return downstream(features, extract(features, WHOLE), coverage, simplex)
}

function runControl(
  features: BamSlightlyLazyFeature[],
  region: Window,
  coverage: ReturnType<typeof computeCoverage>,
  simplex: ReadonlySet<string>,
) {
  const mods = extract(features, region)
  return downstream(features, mods, coverage, simplex)
}

function signature(mods: ModificationEntry[]) {
  return mods
    .map(m => `${m.readIndex}:${m.position}:${m.modType}:${m.prob}:${m.color}`)
    .sort()
    .join('|')
}

const bam = new BamFile({
  bamPath: join(BAM, '200x.longread.mod.bam'),
  recordClass: BamSlightlyLazyFeature,
})
await bam.getHeader()

console.log(
  'width    reads  marks(window)  marks(whole)   window    whole  control  whole/window',
)
for (const width of WIDTHS) {
  const region = {
    start: CENTER - Math.floor(width / 2),
    end: CENTER + Math.ceil(width / 2),
  }
  const features = await bam.getRecordsForRange(
    REFNAME,
    region.start,
    region.end,
  )
  const coverage = computeCoverage(
    features.map(f => ({ start: f.start, end: f.end, strand: getStrand(f) })),
    [],
    region.start,
    region.end,
  )
  const seen = new Map<string, ModificationType>()
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    extractModifications(
      f,
      i,
      f.start,
      getStrand(f),
      region,
      { type: 'normal' },
      new Set(),
      seen,
      [],
    )
  }
  const simplex = detectSimplexModifications([...seen.values()])

  const windowMods = extract(features, region)
  const wholeMods = extract(features, WHOLE)
  const cut = wholeMods.filter(
    m => m.position >= region.start && m.position < region.end,
  )
  if (signature(windowMods) !== signature(cut)) {
    throw new Error(
      `width ${width}: windowed marks differ from whole-read marks cut to the region`,
    )
  }

  const best = { window: Infinity, whole: Infinity, control: Infinity }
  let sink = 0
  for (let r = 0; r < ROUNDS; r++) {
    for (let k = 0; k < 3; k++) {
      const which = (r + k) % 3
      globalThis.gc?.()
      const t = performance.now()
      if (which === 0) {
        sink += runWindow(features, region, coverage, simplex)
      } else if (which === 1) {
        sink += runWhole(features, region, coverage, simplex)
      } else {
        sink += runControl(features, region, coverage, simplex)
      }
      const dt = performance.now() - t
      const key = which === 0 ? 'window' : which === 1 ? 'whole' : 'control'
      best[key] = Math.min(best[key], dt)
    }
  }
  let extractMs = Infinity
  let countsMs = Infinity
  for (let r = 0; r < ROUNDS; r++) {
    globalThis.gc?.()
    const t0 = performance.now()
    const mods = extract(features, region)
    const t1 = performance.now()
    const positions = new Set<number>()
    for (const m of mods) {
      positions.add(m.position)
    }
    sink += computeReadBaseCounts(features, positions).size
    const t2 = performance.now()
    extractMs = Math.min(extractMs, t1 - t0)
    countsMs = Math.min(countsMs, t2 - t1)
  }
  console.log(
    `  window split: extract ${extractMs.toFixed(1)} ms, read-base counts ${countsMs.toFixed(1)} ms`,
  )
  console.log(
    [
      String(width).padStart(6),
      String(features.length).padStart(7),
      String(windowMods.length).padStart(13),
      String(wholeMods.length).padStart(13),
      best.window.toFixed(1).padStart(8),
      best.whole.toFixed(1).padStart(8),
      best.control.toFixed(1).padStart(8),
      (best.whole / best.window).toFixed(2).padStart(13),
    ].join(' '),
    sink === 0 ? '(empty)' : '',
  )
}
