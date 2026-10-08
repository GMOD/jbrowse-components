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
// THE QUESTION, as it stood. `sashimiArcSections` read `view.visibleRegions` and
// `makeBpToScreenX(view)`, so it invalidates on every pan and zoom frame, and
// inside it `mergeJunctions` rebuilds a string-keyed Map with one object per
// junction from scratch. The merge answers to loaded data and two filter
// settings; only the projection answers to the pan. So the frame pays for both
// halves and owes one. This measures which half it is.
//
// ARMS. Each is a whole frame's worth for ONE lane, written out longhand — a
// shared driver goes polymorphic and puts the control off 1.00.
//
//   whole    what shipped: `mergeJunctions` then `projectSashimiArcs`
//   project  what a frame owes: `projectSashimiArcs` off a merge held elsewhere
//   control  a second, separately-declared driver over the same two calls
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
import { CUBIC_APEX_RATIO, measureText } from '@jbrowse/core/util'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { visibleRegionJunctions } from '../src/features/sashimi/computeOverlay.ts'
import { mergeJunctions } from '../src/features/sashimi/junctions.ts'
import { encodeDinucleotide } from '../src/features/sashimi/motif.ts'

import type { WorkerPileupData } from '../src/RenderAlignmentDataRPC/types.ts'
import type {
  MergedJunction,
  RegionJunctions,
} from '../src/features/sashimi/junctions.ts'

// ---------------------------------------------------------------------------
// THE PROJECTION AS IT RAN, frozen here. The arcs are link marks since ADR-222:
// their feed is in bp and a pan writes a uniform, so the display no longer has
// this function and a frame runs neither half for them. It stays so the
// published split can be taken again.
// ---------------------------------------------------------------------------
interface SashimiArc {
  d: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  strand: number
  motif: number
  labelX: number
  labelY: number
  // false when the arc is too narrow on screen to fit its count text
  showLabel: boolean
}

interface SashimiArcsBySide {
  up: SashimiArc[]
  down: SashimiArc[]
}

// Every field here moves during a gesture; the merge's inputs do not.
interface ProjectSashimiArcsOpts {
  bpToScreenX: (refName: string, bp: number) => number | undefined
  // the box both hosts draw into, so the cull cannot drop an arc either shows
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
  // by `junctionKey`, decided in `junctions.ts` from the loaded data so the
  // strip the layout reserved and the arcs drawn into it are one decision
  downJunctionKeys: ReadonlySet<string>
}

// Owned here because `labelSpanPx` and the apex clearance both depend on them.
const SASHIMI_LABEL_FONT_SIZE = 9
const SASHIMI_LABEL_HALO_WIDTH = 2.5

const MIN_LABEL_SPAN_PX = 22
const LABEL_PADDING_PX = 6

// The digit term: a 4-5 digit count on deep RNA-seq overflowed its arc under a
// flat 22px threshold.
function labelSpanPx(count: number) {
  return Math.max(
    MIN_LABEL_SPAN_PX,
    measureText(count, SASHIMI_LABEL_FONT_SIZE) + LABEL_PADDING_PX,
  )
}

// Arc height follows the junction's genomic span on a fixed log scale, so it is
// zoom-invariant and independent of which other arcs are on screen.
const MIN_ARC_FRAC = 0.3
const MAX_ARC_FRAC = 0.95
const SPAN_REF_MIN_BP = 50
const SPAN_REF_MAX_BP = 100_000

// Room the count label needs past a down arc's apex. Only the down band pays
// it, because only the down band is clipped; an up arc's label draws into the
// histogram's scalebar margin. Charging the up band too took 16% off every arc
// in the default 45px coverage band to avoid a rare overlap with the axis text.
const SASHIMI_APEX_CLEARANCE_PX =
  SASHIMI_LABEL_FONT_SIZE / 2 + SASHIMI_LABEL_HALO_WIDTH / 2

// Screen-ordered: a reversed region maps start to the larger x.
function screenSpan(x1: number, x2: number) {
  const [left, right] = x1 <= x2 ? [x1, x2] : [x2, x1]
  return { left, right, spanPx: right - left }
}

// Floored at 1px: a thinner stroke can be neither seen nor hovered.
function strokeWidthForCount(count: number) {
  return Math.max(1, Math.log(count + 1))
}

function arcHeightFraction(genomicSpan: number) {
  const logRefMin = Math.log(SPAN_REF_MIN_BP)
  const logRefRange = Math.log(SPAN_REF_MAX_BP) - logRefMin
  const norm = Math.min(
    1,
    Math.max(0, (Math.log(Math.max(1, genomicSpan)) - logRefMin) / logRefRange),
  )
  return MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm
}

// Band-local geometry per side. Both bands floor at 0: nothing floors a
// config-declared height, and a negative band flips the arcs through the
// neighbouring band instead of collapsing them flat.
function bandGeometry(
  side: keyof SashimiArcsBySide,
  heights: { effectiveHeight: number; sashimiArcsHeight: number },
) {
  return side === 'down'
    ? {
        band: Math.max(
          0,
          heights.sashimiArcsHeight - SASHIMI_APEX_CLEARANCE_PX,
        ),
        baseline: 0,
        dir: 1,
      }
    : {
        band: heights.effectiveHeight,
        baseline: heights.effectiveHeight,
        dir: -1,
      }
}

function arcCubic(
  span: { left: number; right: number },
  baseline: number,
  apexY: number,
) {
  const { left, right } = span
  const ctrl = baseline + (apexY - baseline) / CUBIC_APEX_RATIO
  return {
    d: `M ${left} ${baseline} C ${left} ${ctrl}, ${right} ${ctrl}, ${right} ${baseline}`,
    labelX: (left + right) / 2,
    labelY: apexY,
  }
}

const byScore = (a: SashimiArc, b: SashimiArc) => a.score - b.score

/**
 * The frame-owed half: merged junctions in, screen geometry out, each side
 * ascending by score. That order is document order, so a heavy junction paints
 * over, and takes the hover from, a light one drawn near it.
 */
function projectSashimiArcs(
  merged: Iterable<MergedJunction>,
  opts: ProjectSashimiArcsOpts,
): SashimiArcsBySide {
  const {
    bpToScreenX,
    viewWidthPx,
    coverageHeight,
    sashimiArcsHeight,
    downJunctionKeys,
  } = opts
  // Up arcs hang off the histogram's zero line, one scalebar offset above the
  // band bottom; the overlay already places the band at the histogram top, a
  // second offset down.
  const effectiveHeight = Math.max(
    0,
    coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET,
  )
  const out: SashimiArcsBySide = { up: [], down: [] }
  for (const j of merged) {
    const x1 = bpToScreenX(j.refName, j.start)
    const x2 = bpToScreenX(j.refName, j.end)
    // an end inside a collapsed intron has no pixel to hang from
    if (x1 === undefined || x2 === undefined) {
      continue
    }
    const span = screenSpan(x1, x2)
    const strokeWidth = strokeWidthForCount(j.count)
    // A cull, not a filter or a cap: an arc's ink runs foot to foot in x, so
    // one whose span misses the box paints nothing, and nothing has to decide
    // which junctions matter. Blocks extend past the viewport, so these are
    // common.
    const inkPad = strokeWidth / 2
    if (span.right < -inkPad || span.left > viewWidthPx + inkPad) {
      continue
    }
    // 'up' reserves no strip, so it is the safe side for a junction the
    // layout's merge somehow never saw
    const side = downJunctionKeys.has(j.key) ? 'down' : 'up'
    const { band, baseline, dir } = bandGeometry(side, {
      effectiveHeight,
      sashimiArcsHeight,
    })
    const arcHeight = band * arcHeightFraction(Math.abs(j.end - j.start))
    out[side].push({
      ...arcCubic(span, baseline, baseline + dir * arcHeight),
      strokeWidth,
      start: j.start,
      end: j.end,
      refName: j.refName,
      score: j.count,
      strand: j.strand,
      motif: j.motif,
      showLabel: span.spanPx >= labelSpanPx(j.count),
    })
  }
  out.up.sort(byScore)
  out.down.sort(byScore)
  return out
}

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

// The worker's output shape for one region: seven parallel arrays, one entry per
// distinct junction. Only the sashimi fields are read, so the rest is absent.
function regionData(junctions: Junction[]) {
  const n = junctions.length
  const sashimiX1 = new Uint32Array(n)
  const sashimiX2 = new Uint32Array(n)
  const sashimiCounts = new Uint32Array(n)
  const sashimiFwd = new Uint32Array(n)
  const sashimiRev = new Uint32Array(n)
  const sashimiDonors = new Uint8Array(n)
  const sashimiAcceptors = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const j = junctions[i]!
    sashimiX1[i] = j.start
    sashimiX2[i] = j.end
    sashimiCounts[i] = j.count
    sashimiFwd[i] = i % 2 === 0 ? j.count : 0
    sashimiRev[i] = i % 2 === 0 ? 0 : j.count
    // GT / AG — a canonical junction, so nothing is filtered on the motif and
    // both arms carry every junction through.
    sashimiDonors[i] = encodeDinucleotide('GT')
    sashimiAcceptors[i] = encodeDinucleotide('AG')
  }
  return {
    sashimiX1,
    sashimiX2,
    sashimiCounts,
    sashimiFwd,
    sashimiRev,
    sashimiDonors,
    sashimiAcceptors,
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

const mergeOpts = { minSashimiScore: 2, showNonCanonicalJunctions: true }

// ARM 1: whole — what shipped. Merges the visible regions, then projects.
function frameWhole(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  visibleRegions: { refName: string; displayedRegionIndex: number }[],
) {
  return projectSashimiArcs(
    mergeJunctions(
      visibleRegionJunctions(rpcDataMap, visibleRegions),
      mergeOpts,
    ).values(),
    projectOpts,
  )
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
  return projectSashimiArcs(
    mergeJunctions(
      visibleRegionJunctions(rpcDataMap, visibleRegions),
      mergeOpts,
    ).values(),
    projectOpts,
  )
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function firstDifference(sa: SashimiArcsBySide, sb: SashimiArcsBySide) {
  const a: SashimiArc[] = [...sa.up, ...sa.down]
  const b: SashimiArc[] = [...sb.up, ...sb.down]
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
      `${merged.length} merged, ${outWhole.up.length + outWhole.down.length} arcs drawn, min of ${ROUNDS} rotated rounds\n` +
      `  whole (was)   ${ms(best.whole)} ms\n` +
      `  project (is)  ${ms(best.project)} ms   ${x(best.project)}   ` +
      `output ${diffProject ? `DIFFERS — ${diffProject}` : 'identical'}\n` +
      `  control       ${ms(best.ctl)} ms   ${x(best.ctl)}   <- noise floor\n` +
      `  merge saved   ${ms(best.whole - best.project)} ms/frame/lane\n`,
  )
}

await main()
