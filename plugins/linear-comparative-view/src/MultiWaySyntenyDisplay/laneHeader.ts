import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'
import { measureText } from '@jbrowse/core/util/measureText'

import { laneOf } from './copyLane.ts'
import { frameOpenings, laneBpOfOpened } from './layoutMultiWay.ts'

import type { Lane } from './laneStack.ts'
import type { LaneBlock, LaneChange } from './layoutMultiWay.ts'

export const LABEL_FONT_SIZE = 10
export const LABEL_BASELINE_OFFSET = 3
export const INLINE_CHIP_OPACITY = 0.85
export const INLINE_CHIP_PAD_PX = 3
export const LANE_COLOR_SWATCH_PX = LABEL_FONT_SIZE
export const LANE_COLOR_TINT = 0.3
export const HEADER_INSET_PX = 2
export const HEADER_GAP_PX = 4
export const BADGE_PAD_PX = 3

// `row.y` is a baseline; a `line-height: 1` box's baseline sits 0.84 em down
export const LABEL_BASELINE_RATIO = 0.84

export function labelBoxTop(y: number) {
  return y - LABEL_FONT_SIZE * LABEL_BASELINE_RATIO
}

// centred on the gene row, and bottom-aligned on one shorter than the text so
// the name stays clear of the gene names below
function inlineBoxOffset(glyphHeight: number) {
  const slack = glyphHeight - LABEL_FONT_SIZE
  return Math.min(slack / 2, slack + 1)
}

/** px a name on the gene row stands above that row's top */
export function inlineNameRise(glyphHeight: number) {
  return Math.max(0, -inlineBoxOffset(glyphHeight))
}

function inlineBaseline(glyphTop: number, glyphHeight: number) {
  return (
    glyphTop +
    inlineBoxOffset(glyphHeight) +
    LABEL_FONT_SIZE * LABEL_BASELINE_RATIO
  )
}

export interface LaneHeaderRow {
  assemblyName: string
  label: string
  /** the contigs holding more of the window than the lane shows, `· also on chr9` */
  alsoOn?: string
  scale: string
  /** what the scale means, as a hover title */
  scaleTitle?: string
  /** the text baseline, in stack px */
  y: number
  isAnchor: boolean
  inline: boolean
  /** the genome this lane's ribbons are read against, where it is not the lane above */
  against?: string
  /** the deletions, insertions and inversions against the anchor the shown frame meets */
  changes?: { text: string; anchor: string }
  /** the swatch beside the label and its tint: the lane's `rows.colors` entry, else its source's color */
  color?: string
}

const LISTED_CHANGES = 2

const MIN_CHANGE_PAD_BP = 1000

function bpText(n: number) {
  return n >= 1_000_000
    ? `${Number((n / 1_000_000).toPrecision(2))} Mb`
    : n >= 1000
      ? `${Number((n / 1000).toPrecision(2))} kb`
      : `${n} bp`
}

/**
 * Why a lane the window shows none of still draws a row: a deletion its record
 * states across the whole window, or a lane chosen by name
 */
export type Placeless = { kind: 'deletion'; bp: number } | { kind: 'unaligned' }

function placelessText(placeless: Placeless) {
  return placeless.kind === 'deletion'
    ? `no step on the reference across ${bpText(placeless.bp)}`
    : 'no alignment in this window'
}

/** the stated changes the lane's shown frame meets, largest first */
export function shownLaneChanges(
  lane: Pick<Lane, 'frame' | 'canon'>,
  stated: readonly LaneChange[],
) {
  const region = laneRegion(lane)
  return region
    ? stated
        .filter(
          ({ at, laneBp }) => at <= region.end && at + laneBp >= region.start,
        )
        .toSorted((a, b) => b.bp - a.bp)
    : []
}

export function changeLabel({ bp, kind }: LaneChange) {
  return `${bpText(bp)} ${kind}`
}

/** the anchor a change sits on, padded by half its size either side */
export function changeWindow({ anchor, bp }: LaneChange) {
  const pad = Math.max(Math.round(bp / 2), MIN_CHANGE_PAD_BP)
  return {
    refName: anchor.refName,
    start: Math.max(0, anchor.start - pad),
    end: anchor.end + pad,
  }
}

function laneChanges(
  lane: Pick<Lane, 'frame' | 'canon'>,
  stated: readonly LaneChange[],
) {
  const changes = shownLaneChanges(lane, stated)
  const listed = changes.slice(0, LISTED_CHANGES).map(changeLabel)
  const more = changes.length - listed.length
  return listed.length
    ? [...listed, ...(more ? [`${more} more`] : [])].join(', ')
    : undefined
}

export function changesChipWidth(text: string) {
  return measureText(text, LABEL_FONT_SIZE) + 2 * INLINE_CHIP_PAD_PX
}

/** Clamps, since a live pan can put the frame's `min` below zero. */
export function laneRegion(lane: Pick<Lane, 'frame' | 'canon'>) {
  const { frame } = lane
  if (!frame) {
    return undefined
  }
  const openings = frameOpenings(frame)
  const start = Math.max(0, Math.round(laneBpOfOpened(openings, frame.min)))
  return {
    refName: lane.canon(frame.refName),
    start,
    end: Math.max(start + 1, Math.round(laneBpOfOpened(openings, frame.max))),
  }
}

export function blockLocString(
  lane: Pick<Lane, 'canon'>,
  refName: string,
  block: LaneBlock,
) {
  return assembleLocString({
    refName: lane.canon(refName),
    start: Math.round(block.start),
    end: Math.round(block.end),
  })
}

function scaleOf(lane: Lane, visibleBpSpan: number) {
  const windowSpan = getBpDisplayStr(visibleBpSpan)
  const laneSpan = lane.frame ? lane.frame.max - lane.frame.min : 0
  const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
  const times = `${Number(multiple.toFixed(1))}×`
  return lane.isAnchor
    ? visibleBpSpan > 0
      ? {
          text: windowSpan,
          title:
            'The span of the window. Other lanes share this scale unless marked squeezed.',
        }
      : { text: '' }
    : multiple > 1.02
      ? {
          text: `${getBpDisplayStr(laneSpan)}, squeezed ${times}`,
          title: `This lane has ${getBpDisplayStr(laneSpan)} across the anchor's ${windowSpan} window, so it is drawn ${times} smaller to fit.`,
        }
      : { text: '' }
}

/** a header's text as the static export draws it, `alsoOn` after the label */
export function headerText({ label, alsoOn }: LaneHeaderRow) {
  return alsoOn ? `${label}  ${alsoOn}` : label
}

export function laneHeaderRows(
  lanes: Lane[],
  visibleBpSpan: number,
  anchorWhere: string,
  inlineGlyphHeight?: number,
  /** names the anchor on each mate lane that is read against it */
  against?: string,
  changesOf: (
    assemblyName: string,
    refName: string,
  ) => readonly LaneChange[] = () => [],
  placelessOf: (assemblyName: string) => Placeless | undefined = () =>
    undefined,
  colorOf: (assemblyName: string) => string | undefined = () => undefined,
): LaneHeaderRow[] {
  const inline = inlineGlyphHeight !== undefined
  const anchor = lanes.find(lane => lane.isAnchor)?.label
  return lanes.map(lane => {
    const region = laneRegion(lane)
    const loc = region && assembleLocString(region)
    // a copy lane's label names its contig already
    const shownRegion =
      region && laneOf(lane.assemblyName).refName !== undefined
        ? loc?.slice(region.refName.length + 1)
        : loc
    const where = lane.isAnchor
      ? anchorWhere
      : lane.frame && `${shownRegion}${lane.frame.flipped ? ' [rev]' : ''}`
    const more = lane.frame?.alsoOnMore
      ? ` and ${lane.frame.alsoOnMore} more`
      : ''
    const alsoOn = lane.frame?.alsoOn.length
      ? `· also on ${lane.frame.alsoOn.map(ref => lane.canon(ref)).join(', ')}${more}`
      : undefined
    const frame = lane.frame
    const alsoAt = frame?.alsoAt.length
      ? `· also at ${frame.alsoAt.map(block => blockLocString(lane, frame.refName, block)).join(', ')}`
      : undefined
    const placeless =
      frame || lane.isAnchor ? undefined : placelessOf(lane.assemblyName)
    const changes = frame
      ? laneChanges(lane, changesOf(lane.assemblyName, frame.refName))
      : placeless && placelessText(placeless)
    const scale = scaleOf(lane, visibleBpSpan)
    return {
      assemblyName: lane.assemblyName,
      label: inline
        ? `${lane.label}${lane.frame?.flipped ? ' [rev]' : ''}`
        : [lane.label, where, alsoAt].filter(part => !!part).join('  '),
      alsoOn: inline ? undefined : alsoOn,
      scale: scale.text,
      scaleTitle: scale.title,
      y: inline
        ? inlineBaseline(lane.glyphTop, inlineGlyphHeight)
        : lane.layerTop - LABEL_BASELINE_OFFSET,
      isAnchor: lane.isAnchor,
      inline,
      against: lane.isAnchor ? undefined : against,
      changes:
        changes && anchor !== undefined ? { text: changes, anchor } : undefined,
      color: colorOf(lane.assemblyName),
    }
  })
}
