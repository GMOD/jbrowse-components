import { clamp } from '@jbrowse/core/util'

import { frameSpan, groupRunSpansOnRow } from './layoutMultiWay.ts'

import type { LaneGene } from './geneGlyph.ts'
import type { MultiWayGroup, RowFrame, Span } from './layoutMultiWay.ts'

const LABEL_HEIGHT = 12
const MIN_GLYPH_PX = 5
const MAX_GLYPH_PX = 18

// A lane pitch below this is an unreadable crush, so the stack stops dividing
// the track height and lays out at this fixed pitch instead, scrolling inside
// the viewport. 22 sits under the tightest committed figure
// (multiway_synteny/ecoli_symbol_*: 47 lanes in 1100 px ≈ 23.4 px/lane), so
// every existing spec keeps today's divide-the-height layout, and above the
// crush where headers collide into glyphs.
export const MIN_LANE_PITCH = 22

/**
 * The stack's full drawn height: the track `height` while every lane keeps at
 * least MIN_LANE_PITCH of it, fixed-pitch — and taller than the track — below
 * that. A FLOOR, not a re-layout: at or above the floor the layout is exactly
 * the divide-the-height one.
 */
export function laneContentHeight(height: number, rowCount: number) {
  return Math.max(height, rowCount * MIN_LANE_PITCH)
}

export interface LaneBand {
  glyphTop: number
  bandTop: number
  bandStart: number
  bandEnd: number
}

export interface LaneGeometry {
  glyphHeight: number
  bandHeight: number
  /** `laneContentHeight` — what the rows tile and a scroll can reach */
  contentHeight: number
  rows: LaneBand[]
}

// Where each lane's header, glyphs and opaque band sit in a stack
// `laneContentHeight(height, rowCount)` px tall. The bands TILE — a lane owns
// half the gutter on each side — so the view's gridlines, true on the anchor
// lane and a lie on every other one, are covered everywhere below the anchor
// rather than standing in the gaps.
export function laneGeometry(height: number, rowCount: number): LaneGeometry {
  const contentHeight = laneContentHeight(height, rowCount)
  const glyphHeight = clamp(
    contentHeight / rowCount - LABEL_HEIGHT - 6,
    MIN_GLYPH_PX,
    MAX_GLYPH_PX,
  )
  const usable = contentHeight - LABEL_HEIGHT - glyphHeight - 4
  const glyphTop = (row: number) =>
    LABEL_HEIGHT + (rowCount === 1 ? 0 : (row * usable) / (rowCount - 1))
  const bandStart = (row: number) =>
    row === 0
      ? 0
      : (glyphTop(row - 1) + glyphHeight + glyphTop(row) - LABEL_HEIGHT) / 2
  return {
    glyphHeight,
    bandHeight: LABEL_HEIGHT + glyphHeight,
    contentHeight,
    rows: Array.from({ length: rowCount }, (_, row) => ({
      glyphTop: glyphTop(row),
      bandTop: glyphTop(row) - LABEL_HEIGHT,
      bandStart: bandStart(row),
      bandEnd: row + 1 < rowCount ? bandStart(row + 1) : contentHeight,
    })),
  }
}

/**
 * One lane of the stack, and the display's central noun: every layer the
 * picture is made of — bands, ticks, ribbons, glyphs, boxes, headers, the hover
 * outline — is a walk over these.
 *
 * It carries the two FUNCTIONS a lane answers with as well as its data,
 * because the answers differ by lane kind and every caller that re-derived
 * which kind it was had a chance to get it wrong: the anchor lane maps bp
 * through the view's own piecewise axis and calls a sequence whatever its
 * assembly does, a mate lane maps through its own affine frame and may be
 * looking at a genome the session does not hold at all.
 */
export interface Lane {
  assemblyName: string
  /** the top lane, drawn on the view's own axis rather than a frame of its own */
  isAnchor: boolean
  /**
   * undefined on the anchor lane, and on a mate lane the visible groups place
   * nothing on
   */
  frame: RowFrame | undefined
  /** this lane's own gene models, empty until the dependent fetch lands */
  genes: LaneGene[]
  /**
   * whether the SESSION holds an annotation track for this lane — a different
   * question from whether `genes` is empty, which this window can answer no to
   * over a gene desert
   */
  hasAnnotation: boolean
  /**
   * The groups this lane places, keyed by group key and in the groups' own
   * anchor-sorted order — each with the px spans it draws them at, one per run
   * of placements the lane shows.
   *
   * The group rides along with its spans because every layer needs both and
   * joining two structures was the layers' job before: the boxes want the
   * feature to color and open, the ribbons want the same feature for the click
   * and the far lane's spans by key, and a lane that answered only in spans
   * could disagree with the group list it was built from.
   */
  placements: Map<string, LaneGroup>
  /**
   * One of this lane's own bp intervals in px, or `undefined` for an interval
   * the lane does not reach.
   *
   * Both kinds CLIP rather than test — see `axisSpan` and `frameSpan` — so a
   * feature straddling the edge draws the half the lane can place instead of
   * vanishing whole.
   */
  spanOf: (refName: string, start: number, end: number) => Span | undefined
  /**
   * What this lane calls a sequence. A placement carries whatever refName the
   * table's BED used, a gene whatever that assembly's GFF3 used, and for a
   * genome whose annotation names sequences by INSDC accession those are
   * `CM028642.2` and `3L`. The assembly's own alias table closes that; raw
   * `===` between two file spellings drops every gene.
   */
  canon: (refName: string) => string
  glyphTop: number
  bandTop: number
  bandStart: number
  bandEnd: number
}

export interface LaneGroup {
  group: MultiWayGroup
  spans: Span[]
  /**
   * per span, how that run reads against the ANCHOR: 1 on the anchor lane,
   * and on a mate lane the run's length-weighted strand vote. Kept beside the
   * span rather than re-derived from its px order, because a lane drawn
   * flipped has already straightened the span of an inverted run
   */
  orientations: number[]
}

export interface LaneStack {
  lanes: Lane[]
  glyphHeight: number
  bandHeight: number
}

export interface BuildLanesOpts {
  /** the anchor assembly first, then the mate lanes in the order they draw */
  assemblyNames: string[]
  groups: MultiWayGroup[]
  /** where the anchor lane draws each group, off the view's own `bpToPx` */
  anchorSpans: Map<string, Span>
  rowFrames: Map<string, RowFrame | undefined>
  laneGenes: Map<string, LaneGene[]> | undefined
  laneGeneAdapters: Map<string, unknown>
  /** an interval on the anchor lane's axis, clipped — `axisSpan` bound to the view */
  axisSpanOf: (refName: string, start: number, end: number) => Span | undefined
  /** the session's assembly under a lane's name, for the refName alias table */
  refNameAliasOf: (
    assemblyName: string,
  ) => ((refName: string) => string) | undefined
  width: number
  height: number
}

/**
 * The whole stack, resolved once: the lane records plus the geometry every
 * layer places against.
 *
 * Pure, and on the model rather than in the component, for the reason the
 * tests found the hard way — `layoutMultiWay.test.ts` covers the PIECES (the
 * frames, the runs, the spans, the band tiling) exhaustively, and every defect
 * this display has shipped was in the ASSEMBLY of those pieces into a lane.
 * A stack the component built inside its own render had nowhere for a test to
 * stand.
 */
export function buildLanes({
  assemblyNames,
  groups,
  anchorSpans,
  rowFrames,
  laneGenes,
  laneGeneAdapters,
  axisSpanOf,
  refNameAliasOf,
  width,
  height,
}: BuildLanesOpts): LaneStack {
  const { glyphHeight, bandHeight, rows } = laneGeometry(
    height,
    assemblyNames.length,
  )
  return {
    glyphHeight,
    bandHeight,
    lanes: assemblyNames.map((assemblyName, row) => {
      const isAnchor = row === 0
      const frame = isAnchor ? undefined : rowFrames.get(assemblyName)
      const alias = refNameAliasOf(assemblyName)
      // asked once per exon interval of every gene, and the alias table is a
      // live assembly read — a lane's genes name one or two sequences
      const canonical = new Map<string, string>()
      const canon = (refName: string) => {
        let name = canonical.get(refName)
        if (name === undefined) {
          name = alias?.(refName) ?? refName
          canonical.set(refName, name)
        }
        return name
      }
      const frameRefName = frame && canon(frame.refName)

      const placements = new Map<string, LaneGroup>()
      for (const group of groups) {
        const anchorSpan = anchorSpans.get(group.key)
        const runs = isAnchor
          ? anchorSpan
            ? [{ span: anchorSpan, orientation: 1 }]
            : []
          : frame
            ? groupRunSpansOnRow(group, assemblyName, frame, width)
            : []
        if (runs.length) {
          placements.set(group.key, {
            group,
            spans: runs.map(run => run.span),
            orientations: runs.map(run => run.orientation),
          })
        }
      }

      return {
        assemblyName,
        isAnchor,
        frame,
        genes: laneGenes?.get(assemblyName) ?? [],
        hasAnnotation: laneGeneAdapters.has(assemblyName),
        placements,
        canon,
        spanOf: isAnchor
          ? (refName: string, start: number, end: number) =>
              axisSpanOf(canon(refName), start, end)
          : (refName: string, start: number, end: number) =>
              frame && canon(refName) === frameRefName
                ? frameSpan(frame, start, end, width)
                : undefined,
        ...rows[row]!,
      }
    }),
  }
}
