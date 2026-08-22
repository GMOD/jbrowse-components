import { splitJunctionKind } from '@jbrowse/alignments-core'

import { LINKED_READ_SLOT_CATEGORY } from '../../shaders/palettes.ts'
import { PAIR_DIRECTION_NUM } from '../../shared/buildBaseFeatureData.ts'
import {
  SPLIT_JUNCTION_LABELS,
  readColorCategoryLabel,
} from '../../shared/legendUtils.ts'
import {
  connectionEndpoints,
  interchromOf,
  pairFieldEntry,
  readGroupConnections,
} from '../../shared/readGroupConnections.ts'
import { readNameAt } from '../../shared/readNameBlock.ts'
import { getOrCreate } from '../../shared/util.ts'

import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedReadLinesUploadData } from './types.ts'

// Color type indices for linked-read connecting lines + bezier curves.
// Shared by main-thread (Canvas2D / SVG) and the GPU palette uniform.
// Order is fixed to match linkedReadColorPalette in shaders/palettes.ts.
//
// The four pair slots ARE the worker's orientation codes, because
// `pairedColorType` below passes an orientNum through unchanged. Taken from
// PAIR_DIRECTION_NUM rather than restated, so the two orderings cannot be
// renumbered apart — they used to be two hand-kept lists under a SYNC comment.
export const LINKED_READ_COLOR_PAIR_UNKNOWN = 0
export const LINKED_READ_COLOR_PAIR_LR = PAIR_DIRECTION_NUM.LR
export const LINKED_READ_COLOR_PAIR_RL = PAIR_DIRECTION_NUM.RL
export const LINKED_READ_COLOR_PAIR_RR = PAIR_DIRECTION_NUM.RR
export const LINKED_READ_COLOR_PAIR_LL = PAIR_DIRECTION_NUM.LL
// The split-read slots continue past the pair block; they have no orientation
// code of their own, so they number off its end.
export const LINKED_READ_COLOR_SPLIT_NORMAL = LINKED_READ_COLOR_PAIR_LL + 1
export const LINKED_READ_COLOR_SPLIT_INV = LINKED_READ_COLOR_PAIR_LL + 2
// A MATE LINK whose two ends are on different chromosomes. Last, in the slot
// that was a dead duplicate of the LR fallback — `pairedColorType` and
// `splitColorType` between them never emitted it — so the palette keeps its
// eight entries and `LINKED_READ_COLOR_SLOTS` does not move.
//
// Its own slot because orientation is meaningless across a translocation, which
// the other two vocabularies already say: a read fill takes `interchrom` ahead
// of every orientation bucket, and the arc band refuses to draw an arc at all
// and drops a tick at each breakpoint. Only this overlay still asserted an
// LR/RL/RR/LL — and it arrives populated and plausible, because `@gmod/bam`
// resolves `selfIsLeft` from `refId < mateRefId` and hands back a real code off
// an ordering of chromosome ids. So one translocation fragment could carry three
// colours at once, two of them meaning "inter-chromosomal" and one naming an
// orientation nothing measured.
export const LINKED_READ_COLOR_INTERCHROM = LINKED_READ_COLOR_PAIR_LL + 3

// Human-readable connection classification for the bezier-arc hover tooltip and
// its legend row. DERIVED, not restated: the slot's meaning comes from
// LINKED_READ_SLOT_CATEGORY (the table its colour also comes from) and the
// wording from the read key, so a colour means one thing whether the reader met
// it on a swatch, a fill or a curve.
//
// The four pair labels used to be copied here from CATEGORY_LEGEND, under a
// comment saying they must match word for word. They are the same strings now
// because they are the same strings.
//
// The two split labels deliberately do NOT use the read fills' wording, which
// says "paired-end read": a connector is drawn between the segments of any split
// read regardless of pairing, so that claim would be false for every long read
// on screen. `SPLIT_JUNCTION_LABELS` is that override, and the arc overlay reads
// the identical table.
//
// Neither split label names a variant class. `splitJunctionKind` reads the two
// strands and nothing else, and "deletion" — which this said until it was
// noticed in a legend beside its own synonym — is one of several rearrangements
// a same-strand junction is evidence for.
export function connectionLabel(colorType: number) {
  const category = LINKED_READ_SLOT_CATEGORY[colorType]
  // Slot 0 is the unknown baseline. It takes LR's swatch, but calling it LR
  // would assert an orientation nothing measured, so it keeps the neutral
  // wording — as does anything off the end of the table, which `linkedReadColorSlot`
  // clamps into the last slot.
  //
  // The bound used to be `>= length - 1`, holding slot 7 out as a second
  // fallback. It is `interchrom` now and carries a meaning of its own, so the
  // table's last entry is a row like any other.
  return category === undefined || colorType === LINKED_READ_COLOR_PAIR_UNKNOWN
    ? 'Read pair'
    : (SPLIT_JUNCTION_LABELS[category] ?? readColorCategoryLabel(category)!)
}

// The connection color types the overlay draws STRAIGHT rather than as a bezier.
// `computePileupBezierArcs` decides that from `c.isNormal`, and these are the
// color slots that flag it: `pairedColorType` maps every orientation above LR to
// its own aberrant slot and everything at or below it to LR/unknown, and
// `splitColorType` gives a co-linear junction (the split-read reading of
// `isNormal`) SPLIT_NORMAL. So the legend's glyph follows the same rule the path
// shape does — a hand-kept list of "these ones look straight" would not.
//
// The one pair the two rules disagree on is a split with an unknown strand on
// exactly one side, which lands in the unknown slot while drawing as a curve;
// mapped reads always carry ±1, so nothing reaches it.
// `interchrom` is absent, so it draws as a curve — `isNormalOrientation` returns
// false for it below, which is the other half of the same statement. A
// translocated mate link is the definition of discordant, and the display's own
// convention (shared with BreakpointSplitView) is that a line means normal and a
// curve below the reads does not.
const STRAIGHT_CONNECTION_COLORS = new Set([
  LINKED_READ_COLOR_PAIR_UNKNOWN,
  LINKED_READ_COLOR_PAIR_LR,
  LINKED_READ_COLOR_SPLIT_NORMAL,
])

export function connectionMark(colorType: number): 'line' | 'curve' {
  return STRAIGHT_CONNECTION_COLORS.has(colorType) ? 'line' : 'curve'
}

// No refName, unlike the arc path's entry: every comparison this path makes is
// between two on-screen entries, and the overlay resolves each end's refName
// through its own `displayedRegionIndex` at draw time. That difference is why
// the two paths build their own entries; the field ACCESSORS are shared
// (readGroupConnections).
export interface ReadEntry {
  displayedRegionIndex: number
  readIdx: number
  data: LaidOutPileupData
}

// Normal LR pairs — and unknown orientations, which code 0 and are not worth
// calling out — plus same-strand split reads get a straight line; aberrant
// orientations get a bezier curve to stand out visually. A split read is
// "normal" (a plain deletion) when both segments keep the same strand; opposite
// strands flag an inversion.
export function isNormalOrientation(
  hasPaired: boolean,
  orientNum: number,
  s1: number,
  s2: number,
) {
  // Measured against LR rather than a literal 1: everything aberrant numbers
  // above it, so this stays right if the codes are ever renumbered.
  return hasPaired ? orientNum <= PAIR_DIRECTION_NUM.LR : s1 === s2
}

// `orientNum` is a PAIR_DIRECTION_NUM code, passed through as the color index
// unchanged — which the LINKED_READ_COLOR_PAIR_* definitions above make true by
// construction rather than by agreement.
function pairedColorType(orientNum: number) {
  return orientNum >= LINKED_READ_COLOR_PAIR_LR &&
    orientNum <= LINKED_READ_COLOR_PAIR_LL
    ? orientNum
    : LINKED_READ_COLOR_PAIR_UNKNOWN
}

// This path's encoding of the shared junction classifier: an unknown-strand
// split falls back to the default pair color.
const SPLIT_KIND_COLOR = {
  inversion: LINKED_READ_COLOR_SPLIT_INV,
  deletion: LINKED_READ_COLOR_SPLIT_NORMAL,
}

export function splitColorType(s1: number, s2: number) {
  const kind = splitJunctionKind(s1, s2)
  return kind === undefined
    ? LINKED_READ_COLOR_PAIR_UNKNOWN
    : SPLIT_KIND_COLOR[kind]
}

// Group reads across all displayed regions by readName. Used by both the
// straight-line emitter and the bezier-curve emitter.
//
// The arc path has the twin of this loop over its own entry type. Sharing them
// was tried and measured back out — see REJECTED_IDEAS, "One shared
// groupReadsByName".
//
// A nameless feature is skipped rather than bucketed under '': the PAF/synteny
// blocks LGVSyntenyDisplay pushes through this pipeline carry no QNAME, so one
// bucket held every block in view and `splitJunctions` chained them into a run
// of fabricated junctions between features that share nothing. `chainGroupingKey`
// gives the layout the same answer from the other side.
export function groupReadsByName(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
): Map<string, ReadEntry[]> {
  const readsByName = new Map<string, ReadEntry[]>()
  for (const [idx, data] of laidOutPileupMap) {
    const { readKeys } = data
    for (let i = 0; i < readKeys.length; i++) {
      const name = readNameAt(data, i)
      if (name) {
        getOrCreate(readsByName, name, () => []).push({
          displayedRegionIndex: idx,
          readIdx: i,
          data,
        })
      }
    }
  }
  return readsByName
}

export interface ClassifiedPair {
  bp1: number
  bp2: number
  // Actual mate / second-segment strand from the BAM (+1 or -1). Use this for
  // any geometric computation (e.g. bezier tangent direction).
  s1: number
  s2: number
  isNormal: boolean
  colorType: number
  // A split-read junction (drives the fold-back of the second endpoint's bezier
  // handle) vs a paired mate link. Same `isSplit` the resolver assigns; carried
  // through so the overlay doesn't re-derive it.
  isSplit: boolean
}

// Classify a resolved connection. `isSplit` (from readGroupConnections) selects
// the semantics: a mate link uses paired-read rules, a split junction uses
// split-read rules. This lets paired short reads, split long reads, and paired
// reads that are themselves SA-split all coexist in one view.
//
// Geometry is both entries'; the ORIENTATION is the fragment's, so it comes off
// a primary (`pairFieldEntry`) rather than off `e1` whichever segment that
// turned out to be. Reading e1 unconditionally cost this path two things a
// colour alone would not: `isNormal` decides curve-vs-straight, and
// `isBezierArcPair` drops a within-region normal pair entirely — so a
// supplementary reporting LR for a genuinely RL pair took the aberrant
// connection off the overlay and handed it to the plain-line pass, in the one
// case the overlay exists to draw. The arc band already sourced this from a
// primary; the two now read the same rule rather than two spellings of it.
export function classifyPair(
  e1: ReadEntry,
  e2: ReadEntry,
  isSplit: boolean,
): ClassifiedPair {
  const hasPaired = !isSplit
  const { bp1, s1, bp2, s2 } = connectionEndpoints({ e1, e2, isSplit })
  const src = pairFieldEntry(e1, e2)
  const orientNum = src.data.readPairOrientations[src.readIdx]!
  // A MATE LINK only. A split junction is classified from its two segments'
  // strands, which stays true whichever chromosomes they are on — the read
  // crossed that junction, and `splitJunctionKind` never consults a refName. It
  // is the pair rules that break: orientation and insert size describe a
  // fragment on one chromosome, so across a translocation both are answers to a
  // question nobody asked. Read off the same primary the orientation is,
  // interchrom-ness being a fact about the fragment rather than about a segment.
  const interchrom = hasPaired && interchromOf(src)
  const isNormal =
    !interchrom && isNormalOrientation(hasPaired, orientNum, s1, s2)
  const colorType = interchrom
    ? LINKED_READ_COLOR_INTERCHROM
    : hasPaired
      ? pairedColorType(orientNum)
      : splitColorType(s1, s2)
  return { bp1, bp2, s1, s2, isNormal, colorType, isSplit }
}

export interface LinkedPair {
  e1: ReadEntry
  e2: ReadEntry
  c: ClassifiedPair
  // The loci this junction skips over — see `ReadConnection`. Carried on the
  // pair rather than folded into `ClassifiedPair`, which answers what the
  // connection IS; this answers what the view is missing of it.
  hiddenSegmentsBetween?: string[]
}

// Enumerate the connections across all displayed regions: group reads by name,
// then resolve each group into per-mate split junctions + the mate link
// (readGroupConnections owns filtering, read-order sorting, and paired/split
// partitioning). Both the straight-line emitter (computeLinkedReadLinesByRegion)
// and the bezier-curve emitter (computePileupBezierArcs) iterate this, so the
// rules that define "a linked pair" live in one place.
//
// `canonicalRefName` is what lets a junction report the segments it skipped
// (`hiddenSegmentsBetween`) in the view's own refName spelling. Only the emitter
// that can DRAW that — the overlay, which dashes the arc — passes one; the
// straight-line pass omits it and skips the SA parse.
export function* iterLinkedPairs(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
  canonicalRefName?: CanonicalRefName,
): Generator<LinkedPair> {
  for (const [, entries] of groupReadsByName(laidOutPileupMap)) {
    // Pure fast path, NOT a correctness gate — a singleton group yields no
    // connection either way (nothing to chain, and a mate link needs both sides
    // present). It's here because that is the overwhelmingly common group at
    // depth, and skipping it avoids the resolver's dedup Map and its several
    // per-group arrays. Do not grow a branch off this count: which mates are on
    // screen is the mate partition's question, and answering it from an entry
    // count is what once dropped a split read's off-screen mate arc.
    if (entries.length >= 2) {
      for (const {
        e1,
        e2,
        isSplit,
        hiddenSegmentsBetween,
      } of readGroupConnections(entries, canonicalRefName)) {
        yield {
          e1,
          e2,
          c: classifyPair(e1, e2, isSplit),
          hiddenSegmentsBetween,
        }
      }
    }
  }
}

// Build per-region straight-line records for normal-orientation pairs whose
// mates are wholly contained in a single displayedRegion. Returns one map
// entry per region that has at least one line, in the same
// `LinkedReadLinesUploadData` shape the GPU/Canvas2D renderers consume so the
// chain-layout post-pass can spread it straight onto `LaidOutPileupData` with no
// field renaming. Cross-region pairs are excluded — those keep flowing through
// the SVG bezier overlay's straight fallback path.
//
// Output positions are absolute genomic uint32 (worker contract); per-endpoint
// Y is needed because mates can sit on different rows when sorting is on.
export function computeLinkedReadLinesByRegion(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
): Map<number, LinkedReadLinesUploadData> {
  // Collect raw records first by region, then materialize typed arrays.
  const acc = new Map<
    number,
    {
      positions: number[]
      ys: number[]
      colorTypes: number[]
    }
  >()

  for (const { e1, e2, c } of iterLinkedPairs(laidOutPileupMap)) {
    const sameRegion = e1.displayedRegionIndex === e2.displayedRegionIndex
    if (sameRegion && c.isNormal) {
      const idx = e1.displayedRegionIndex
      const bucket = getOrCreate(acc, idx, () => ({
        positions: [],
        ys: [],
        colorTypes: [],
      }))
      bucket.positions.push(c.bp1, c.bp2)
      bucket.ys.push(e1.data.readYs[e1.readIdx]!, e2.data.readYs[e2.readIdx]!)
      bucket.colorTypes.push(c.colorType)
    }
  }

  const out = new Map<number, LinkedReadLinesUploadData>()
  for (const [idx, bucket] of acc) {
    out.set(idx, {
      linkedReadLinePositions: Uint32Array.from(bucket.positions),
      linkedReadLineYs: Uint16Array.from(bucket.ys),
      linkedReadLineColorTypes: Uint8Array.from(bucket.colorTypes),
      numLinkedReadLines: bucket.colorTypes.length,
    })
  }
  return out
}
