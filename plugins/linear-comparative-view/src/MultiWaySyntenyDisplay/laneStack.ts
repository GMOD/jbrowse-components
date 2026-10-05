import { clamp } from '@jbrowse/core/util'

import { GENE_LABEL_FONT_PX, GENE_LABEL_GAP_PX } from './laneLabels.ts'
import { shownFrame } from './laneMotion.ts'
import {
  frameReachPx,
  frameSegmentsX,
  frameSpan,
  frameSpans,
  groupRunSpansOnRow,
} from './layoutMultiWay.ts'

import type {
  MultiWayGroup,
  MultiWayPlacement,
  RowFrame,
  Span,
} from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

const LABEL_HEIGHT = 12
const MIN_GLYPH_PX = 5
const MAX_GLYPH_PX = 18
export const STRAND_GAP_PX = 2
// two strand rows of a compact feature track's gene height
const MAX_SPLIT_GLYPH_PX = 2 * 10 + STRAND_GAP_PX
const MIN_SPLIT_GLYPH_PX = 2 * MIN_GLYPH_PX + STRAND_GAP_PX

// the pitch floor: below it the stack scrolls instead of dividing the height
export const MIN_LANE_PITCH = 22

export function geneLabelRowPx(showGeneLabels: boolean) {
  return showGeneLabels ? GENE_LABEL_FONT_PX + 2 * GENE_LABEL_GAP_PX : 0
}

export function laneContentHeight(
  height: number,
  rowCount: number,
  geneLabelPx = 0,
  layerPx = 0,
) {
  return Math.max(height, rowCount * (MIN_LANE_PITCH + geneLabelPx + layerPx))
}

export interface LaneBand {
  glyphTop: number
  bandTop: number
  layerTop: number
  bandStart: number
  bandEnd: number
}

export interface LaneGeometry {
  glyphHeight: number
  bandHeight: number
  contentHeight: number
  strandRows: boolean
  rows: LaneBand[]
}

// The bands tile, each lane owning half the gutter either side.
export function laneGeometry(
  height: number,
  rowCount: number,
  splitStrands = false,
  geneLabelPx = 0,
  layerPx = 0,
): LaneGeometry {
  const contentHeight = laneContentHeight(
    height,
    rowCount,
    geneLabelPx,
    layerPx,
  )
  const above = LABEL_HEIGHT + layerPx
  const room = contentHeight / rowCount - above - geneLabelPx - 6
  const strandRows = splitStrands && room >= MIN_SPLIT_GLYPH_PX
  const glyphHeight = clamp(
    room,
    MIN_GLYPH_PX,
    strandRows ? MAX_SPLIT_GLYPH_PX : MAX_GLYPH_PX,
  )
  const usable = contentHeight - above - glyphHeight - geneLabelPx - 4
  const glyphTop = (row: number) =>
    above + (rowCount === 1 ? 0 : (row * usable) / (rowCount - 1))
  const bandStart = (row: number) =>
    row === 0
      ? 0
      : (glyphTop(row - 1) +
          glyphHeight +
          geneLabelPx +
          glyphTop(row) -
          above) /
        2
  return {
    glyphHeight,
    bandHeight: above + glyphHeight + geneLabelPx,
    contentHeight,
    strandRows,
    rows: Array.from({ length: rowCount }, (_, row) => ({
      glyphTop: glyphTop(row),
      bandTop: glyphTop(row) - above,
      layerTop: glyphTop(row) - layerPx,
      bandStart: bandStart(row),
      bandEnd: row + 1 < rowCount ? bandStart(row + 1) : contentHeight,
    })),
  }
}

export interface Lane {
  assemblyName: string
  label: string
  isAnchor: boolean
  /** undefined on the anchor lane and on a lane placing nothing visible */
  frame: RowFrame | undefined
  /** the session holds an annotation track for the lane, whatever it fetched */
  hasAnnotation: boolean
  /** keyed by group key, in the groups' anchor-sorted order */
  placements: Map<string, LaneGroup>
  /** a bp interval of this lane in px, clipped, or undefined where it misses */
  spanOf: (refName: string, start: number, end: number) => Span | undefined
  /** `spanOf` of each piece of an ascending interval, cut at every hole */
  spansOf: (refName: string, start: number, end: number) => Span[]
  bpPerPx: number
  /** the canonical refName; compare a BED and a GFF3 spelling through it */
  canon: (refName: string) => string
  /** px the baseline draws over, a screen either side at most */
  baseline: Span[]
  glyphTop: number
  bandTop: number
  layerTop: number
  bandStart: number
  bandEnd: number
  /** two gene rows when set; -1 while a flip is short of halfway */
  strandRows?: 1 | -1
}

export interface LaneGroup {
  group: MultiWayGroup
  spans: Span[]
  /** per span, the run's strand against the anchor, which px order hides */
  orientations: number[]
  /** per span, the unclipped bp interval of the lane's own sequence */
  intervals: MultiWayPlacement[]
  features: Feature[]
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
  /** px, off the view's own `bpToPx` */
  anchorSpans: Map<string, Span>
  rowFrames: Map<string, RowFrame | undefined>
  laneGeneAdapters: Map<string, unknown>
  axisSpanOf: (refName: string, start: number, end: number) => Span | undefined
  anchorRegionSpans: Span[]
  anchorBpPerPx: number
  /** takes a canonical refName */
  contigOf: (
    assemblyName: string,
    refName: string,
  ) => { start: number; end: number } | undefined
  refNameAliasOf: (
    assemblyName: string,
  ) => ((refName: string) => string) | undefined
  width: number
  height: number
  splitStrands?: boolean
  geneLabelPx?: number
  layerPx?: number
  pastHalfway?: ReadonlySet<string>
  labelOf?: (assemblyName: string) => string
}

function clipSpan([a, b]: Span, [lo, hi]: Span): Span[] {
  const left = Math.max(Math.min(a, b), lo)
  const right = Math.min(Math.max(a, b), hi)
  return left < right ? [[left, right]] : []
}

export function buildLanes({
  assemblyNames,
  groups,
  anchorSpans,
  rowFrames,
  laneGeneAdapters,
  axisSpanOf,
  anchorRegionSpans,
  anchorBpPerPx,
  contigOf,
  refNameAliasOf,
  width,
  height,
  splitStrands = false,
  geneLabelPx = 0,
  layerPx = 0,
  pastHalfway = new Set(),
  labelOf = assemblyName => assemblyName,
}: BuildLanesOpts): LaneStack {
  const { glyphHeight, bandHeight, strandRows, rows } = laneGeometry(
    height,
    assemblyNames.length,
    splitStrands,
    geneLabelPx,
    layerPx,
  )
  const reach: Span = [-width, 2 * width]
  return {
    glyphHeight,
    bandHeight,
    lanes: assemblyNames.map((assemblyName, row) => {
      const isAnchor = row === 0
      const frame = isAnchor ? undefined : rowFrames.get(assemblyName)
      const alias = refNameAliasOf(assemblyName)
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
      const framed = frame && frameReachPx(frame, width)
      const clip: Span = framed
        ? [Math.min(reach[0], framed[0]), Math.max(reach[1], framed[1])]
        : reach
      const contig =
        frameRefName === undefined
          ? undefined
          : contigOf(assemblyName, frameRefName)

      const placements = new Map<string, LaneGroup>()
      for (const group of groups) {
        const anchorSpan = anchorSpans.get(group.key)
        const runs = isAnchor
          ? anchorSpan
            ? [
                {
                  span: anchorSpan,
                  orientation: 1,
                  interval: group.anchor,
                  feature: group.feature,
                },
              ]
            : []
          : frame
            ? groupRunSpansOnRow(group, assemblyName, frame, width)
            : []
        if (runs.length) {
          placements.set(group.key, {
            group,
            spans: runs.map(run => run.span),
            orientations: runs.map(run => run.orientation),
            intervals: runs.map(run => run.interval),
            features: runs.map(run => run.feature),
          })
        }
      }

      return {
        assemblyName,
        label: labelOf(assemblyName),
        isAnchor,
        frame,
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
        spansOf: isAnchor
          ? (refName: string, start: number, end: number) => {
              const span = axisSpanOf(canon(refName), start, end)
              return span ? [span] : []
            }
          : (refName: string, start: number, end: number) =>
              frame && canon(refName) === frameRefName
                ? frameSpans(frame, start, end, width)
                : [],
        bpPerPx: isAnchor
          ? anchorBpPerPx
          : frame
            ? (frame.max - frame.min) / width
            : Infinity,
        baseline: isAnchor
          ? anchorRegionSpans.flatMap(span => clipSpan(span, reach))
          : frame
            ? frameSegmentsX(
                frame,
                contig?.start ?? Number.NEGATIVE_INFINITY,
                contig?.end ?? Number.POSITIVE_INFINITY,
                width,
              ).flatMap(span => clipSpan(span, clip))
            : [clip],
        strandRows: !strandRows
          ? undefined
          : frame &&
              shownFrame(frame, pastHalfway.has(assemblyName)).flipped !==
                frame.flipped
            ? -1
            : 1,
        ...rows[row]!,
      }
    }),
  }
}
