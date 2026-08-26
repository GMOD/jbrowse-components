import { clamp } from '@jbrowse/core/util'

import { frameSpan, groupSpansOnRow } from './layoutMultiWay.ts'

import type { MultiWayGroup, RowFrame, Span } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

const LABEL_HEIGHT = 12
const MIN_GLYPH_PX = 5
const MAX_GLYPH_PX = 18

export interface LaneBand {
  glyphTop: number
  bandTop: number
  bandStart: number
  bandEnd: number
}

export interface LaneGeometry {
  glyphHeight: number
  bandHeight: number
  rows: LaneBand[]
}

// Where each lane's header, glyphs and opaque band sit in a track `height` px
// tall. The bands TILE — a lane owns half the gutter on each side — so the
// view's gridlines, true on the anchor lane and a lie on every other one, are
// covered everywhere below the anchor rather than standing in the gaps.
export function laneGeometry(height: number, rowCount: number): LaneGeometry {
  const glyphHeight = clamp(
    height / rowCount - LABEL_HEIGHT - 6,
    MIN_GLYPH_PX,
    MAX_GLYPH_PX,
  )
  const usable = height - LABEL_HEIGHT - glyphHeight - 4
  const glyphTop = (row: number) =>
    LABEL_HEIGHT + (rowCount === 1 ? 0 : (row * usable) / (rowCount - 1))
  const bandStart = (row: number) =>
    row === 0
      ? 0
      : (glyphTop(row - 1) + glyphHeight + glyphTop(row) - LABEL_HEIGHT) / 2
  return {
    glyphHeight,
    bandHeight: LABEL_HEIGHT + glyphHeight,
    rows: Array.from({ length: rowCount }, (_, row) => ({
      glyphTop: glyphTop(row),
      bandTop: glyphTop(row) - LABEL_HEIGHT,
      bandStart: bandStart(row),
      bandEnd: row + 1 < rowCount ? bandStart(row + 1) : height,
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
  genes: Feature[]
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
  laneGenes: Map<string, Feature[]> | undefined
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
      const canon = (refName: string) => alias?.(refName) ?? refName
      const frameRefName = frame && canon(frame.refName)

      const placements = new Map<string, LaneGroup>()
      for (const group of groups) {
        const anchorSpan = anchorSpans.get(group.key)
        const spans = isAnchor
          ? anchorSpan
            ? [anchorSpan]
            : []
          : frame
            ? groupSpansOnRow(group, assemblyName, frame, width)
            : []
        if (spans.length) {
          placements.set(group.key, { group, spans })
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
