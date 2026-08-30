// How much of a sashimi frame is the merge, which the frame does not owe?
//
//   node --expose-gc plugins/alignments/benches/sashimiFrame.bench.ts
//
// Flags: --rounds=<n> (default 60), --copies=<n> (region copies per junction,
// default 1)
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. `sashimiArcSections` reads `view.visibleRegions` and
// `makeBpToScreenX(view)`, so it invalidates on every pan and zoom frame, and
// inside it `mergeJunctions` rebuilds a string-keyed Map with one object per
// junction from scratch. The merge answers to loaded data and two filter
// settings; only the projection answers to the pan. So the frame pays for both
// halves and owes one. This measures which half it is.
//
// ARMS. Each is a whole frame's worth for ONE lane, written out longhand — a
// shared driver goes polymorphic and puts the control off 1.00.
//
//   whole    what shipped: `computeSashimiArcs`, merge then project
//   project  what a frame owes: `projectSashimiArcs` off a merge held elsewhere
//   control  a second, separately-declared driver over `computeSashimiArcs`
//
// THE FIXTURE is real: 651 distinct junctions with their true read support
// (mean 41.7, max 2424), from `samtools view` over
// `https://jbrowse.org/demos/cancer_sv/K562_isoseq.bam` at
// chr22:23,000,000-24,000,000 — a megabase of K562 Iso-Seq, which is a wide
// window on a gene-dense arm and so an upper end of what one lane carries.
// `k562-chr22-junctions.tsv` beside this file is that output; the header of
// `sashimi-frame-split` in agent-docs/measurements has the command.
//
// `--copies` is the collapsed-intron multiplier: the per-region worker re-emits
// a junction in every region its reads reach, so a gene drawn as N exon regions
// hands the merge N copies of each of its junctions and one lane's projection
// still draws one arc each.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS: see the table in
// agent-docs/reference/INTERACTION_PERF.md. Short version, one lane at 651
// junctions: the merge is a small part of the frame and the frame is small.
import {
  computeSashimiArcs,
  projectSashimiArcs,
} from '../src/features/sashimi/computeOverlay.ts'
import { mergeJunctions } from '../src/features/sashimi/junctions.ts'

import type { WorkerPileupData } from '../src/RenderAlignmentDataRPC/types.ts'
import type { SashimiArc } from '../src/features/sashimi/computeOverlay.ts'
import type {
  MergedJunction,
  RegionJunctions,
} from '../src/features/sashimi/junctions.ts'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '60'))
const COPIES = Number(arg('copies', '1'))

const FIXTURE = new URL('k562-chr22-junctions.tsv', import.meta.url)

interface Junction {
  refName: string
  start: number
  end: number
  count: number
}

async function loadFixture(): Promise<Junction[]> {
  const { readFile } = await import('node:fs/promises')
  const text = await readFile(FIXTURE, 'utf8')
  return text
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [key, count] = line.split('\t')
      const [refName, start, end] = key!.split(':')
      return {
        refName: refName!,
        start: Number(start),
        end: Number(end),
        count: Number(count),
      }
    })
}

// The worker's output shape for one region: five parallel arrays, one entry per
// distinct junction. Only the sashimi fields are read, so the rest is absent.
function regionData(junctions: Junction[]) {
  const n = junctions.length
  const sashimiX1 = new Uint32Array(n)
  const sashimiX2 = new Uint32Array(n)
  const sashimiCounts = new Uint32Array(n)
  const sashimiStrands = new Int8Array(n)
  const sashimiMotifs = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const j = junctions[i]!
    sashimiX1[i] = j.start
    sashimiX2[i] = j.end
    sashimiCounts[i] = j.count
    sashimiStrands[i] = i % 2 === 0 ? 1 : -1
    // 1 is GT-AG in motif.ts — a canonical junction, so nothing is filtered on
    // the motif and both arms carry every junction through.
    sashimiMotifs[i] = 1
  }
  return {
    sashimiX1,
    sashimiX2,
    sashimiCounts,
    sashimiStrands,
    sashimiMotifs,
  } as unknown as WorkerPileupData
}

// A megabase across a 1000px-wide view, which is the zoom the fixture's window
// is read at.
const VIEW_WIDTH_PX = 1000
const SPAN_BP = 1_000_000
const FIRST_BP = 23_000_000
const bpToScreenX = (_refName: string, bp: number) =>
  ((bp - FIRST_BP) / SPAN_BP) * VIEW_WIDTH_PX

const NO_DOWN_KEYS: ReadonlySet<string> = new Set()

const projectOpts = {
  bpToScreenX,
  viewWidthPx: VIEW_WIDTH_PX,
  coverageHeight: 100,
  sashimiArcsHeight: 40,
  downJunctionKeys: NO_DOWN_KEYS,
}

const mergeOpts = { minSashimiScore: 2, hideNonCanonicalJunctions: false }

// ARM 1: whole — what shipped. Merges the visible regions, then projects.
function frameWhole(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  visibleRegions: { refName: string; displayedRegionIndex: number }[],
) {
  return computeSashimiArcs({
    ...projectOpts,
    ...mergeOpts,
    rpcDataMap,
    visibleRegions,
  })
}

// ARM 2: project — what a frame owes once the merge is memoized off the pan.
function frameProject(merged: MergedJunction[]) {
  return projectSashimiArcs(merged, projectOpts)
}

// ARM 3: control — a second, separately-declared driver over the same call as
// arm 1. Whatever it scores is what this harness could resolve; a row whose
// control is far from 1.00 measured nothing. The duplication is deliberate.
function frameControl(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  visibleRegions: { refName: string; displayedRegionIndex: number }[],
) {
  return computeSashimiArcs({
    ...projectOpts,
    ...mergeOpts,
    rpcDataMap,
    visibleRegions,
  })
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function firstDifference(a: SashimiArc[], b: SashimiArc[]) {
  if (a.length !== b.length) {
    return `length ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    for (const k of Object.keys(x) as (keyof SashimiArc)[]) {
      if (x[k] !== y[k]) {
        return `arc ${i} field ${k}: ${String(x[k])} vs ${String(y[k])}`
      }
    }
  }
  return ''
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const junctions = await loadFixture()
  const data = regionData(junctions)
  const rpcDataMap = new Map<number, WorkerPileupData>()
  const visibleRegions: { refName: string; displayedRegionIndex: number }[] = []
  const regions: RegionJunctions[] = []
  for (let c = 0; c < COPIES; c++) {
    rpcDataMap.set(c, data)
    visibleRegions.push({
      refName: junctions[0]!.refName,
      displayedRegionIndex: c,
    })
    regions.push({ refName: junctions[0]!.refName, data })
  }
  const merged = [...mergeJunctions(regions, mergeOpts).values()]

  const outWhole = frameWhole(rpcDataMap, visibleRegions)
  const outProject = frameProject(merged)
  const outControl = frameControl(rpcDataMap, visibleRegions)
  const diffProject = firstDifference(outWhole, outProject)
  const diffControl = firstDifference(outWhole, outControl)
  if (diffControl) {
    throw new Error(
      `the control disagrees with the arm it was copied from (${diffControl}) — the harness is broken`,
    )
  }

  const best = { whole: Infinity, project: Infinity, ctl: Infinity }
  const sides = [
    { k: 'whole' as const, run: () => frameWhole(rpcDataMap, visibleRegions) },
    { k: 'project' as const, run: () => frameProject(merged) },
    { k: 'ctl' as const, run: () => frameControl(rpcDataMap, visibleRegions) },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }
  const x = (v: number) => `${(v / best.whole).toFixed(3)}x`
  const ms = (v: number) => v.toFixed(4).padStart(9)
  console.log(
    `sashimi frame, ${junctions.length} junctions x ${COPIES} region cop${COPIES === 1 ? 'y' : 'ies'}, ` +
      `${merged.length} merged, ${outWhole.length} arcs drawn, min of ${ROUNDS} rotated rounds\n` +
      `  whole (was)   ${ms(best.whole)} ms\n` +
      `  project (is)  ${ms(best.project)} ms   ${x(best.project)}   ` +
      `output ${diffProject ? `DIFFERS — ${diffProject}` : 'identical'}\n` +
      `  control       ${ms(best.ctl)} ms   ${x(best.ctl)}   <- noise floor\n` +
      `  merge saved   ${ms(best.whole - best.project)} ms/frame/lane\n`,
  )
}

await main()
