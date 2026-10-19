import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'
import { measureText } from '@jbrowse/core/util/measureText'

import { frameOpenings, laneBpOfOpened } from './layoutMultiWay.ts'

import type { Lane } from './laneStack.ts'
import type { LaneBlock, LaneChange } from './layoutMultiWay.ts'

export const LABEL_FONT_SIZE = 10
export const LABEL_BASELINE_OFFSET = 3
export const INLINE_CHIP_OPACITY = 0.85
export const INLINE_CHIP_PAD_PX = 3

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
  scale: string
  /** the text baseline, in stack px */
  y: number
  isAnchor: boolean
  inline: boolean
  /** the genome this lane's ribbons are read against, where it is not the lane above */
  against?: string
  /** the deletions, insertions and inversions against the anchor the shown frame meets */
  changes?: { text: string; anchor: string }
}

const LISTED_CHANGES = 2

function bpText(n: number) {
  return n >= 1_000_000
    ? `${Number((n / 1_000_000).toPrecision(2))} Mb`
    : n >= 1000
      ? `${Number((n / 1000).toPrecision(2))} kb`
      : `${n} bp`
}

function laneChanges(
  lane: Pick<Lane, 'frame' | 'canon'>,
  stated: readonly LaneChange[],
) {
  const region = laneRegion(lane)
  if (!region) {
    return undefined
  }
  const { start, end } = region
  const changes = stated
    .filter(({ at, bp, kind }) =>
      kind === 'deletion'
        ? at >= start && at <= end
        : at <= end && at + bp >= start,
    )
    .toSorted((a, b) => b.bp - a.bp)
  const listed = changes
    .slice(0, LISTED_CHANGES)
    .map(({ bp, kind }) => `${bpText(bp)} ${kind}`)
  const more = changes.length - listed.length
  return listed.length
    ? [...listed, ...(more ? [`${more} more`] : [])].join(', ')
    : undefined
}

/** one width for every lane's changes chip, so the chips line up */
export function changesChipWidth(rows: readonly LaneHeaderRow[]) {
  const widest = Math.max(
    0,
    ...rows.map(row =>
      row.changes ? measureText(row.changes.text, LABEL_FONT_SIZE) : 0,
    ),
  )
  return widest + 2 * INLINE_CHIP_PAD_PX
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

function scaleLabelOf(lane: Lane, visibleBpSpan: number) {
  if (lane.isAnchor) {
    return visibleBpSpan > 0 ? getBpDisplayStr(visibleBpSpan) : ''
  }
  if (lane.frame === undefined) {
    return ''
  }
  const laneSpan = lane.frame.max - lane.frame.min
  const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
  return multiple > 1.02
    ? `${getBpDisplayStr(laneSpan)}  ${Number(multiple.toFixed(1))}×`
    : getBpDisplayStr(laneSpan)
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
  /** bp of a deletion a lane's record states across the whole window */
  windowDeletionOf: (assemblyName: string) => number | undefined = () =>
    undefined,
): LaneHeaderRow[] {
  const inline = inlineGlyphHeight !== undefined
  const anchor = lanes.find(lane => lane.isAnchor)?.label
  return lanes.map(lane => {
    const where = lane.isAnchor
      ? anchorWhere
      : lane.frame &&
        `${assembleLocString(laneRegion(lane)!)}${lane.frame.flipped ? ' [rev]' : ''}`
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
    const inside = frame ? undefined : windowDeletionOf(lane.assemblyName)
    const changes = frame
      ? laneChanges(lane, changesOf(lane.assemblyName, frame.refName))
      : inside !== undefined && !lane.isAnchor
        ? `inside a ${bpText(inside)} deletion`
        : undefined
    return {
      assemblyName: lane.assemblyName,
      label: inline
        ? `${lane.label}${lane.frame?.flipped ? ' [rev]' : ''}`
        : [lane.label, where, alsoAt, alsoOn].filter(part => !!part).join('  '),
      scale: scaleLabelOf(lane, visibleBpSpan),
      y: inline
        ? inlineBaseline(lane.glyphTop, inlineGlyphHeight)
        : lane.layerTop - LABEL_BASELINE_OFFSET,
      isAnchor: lane.isAnchor,
      inline,
      against: lane.isAnchor ? undefined : against,
      changes:
        changes && anchor !== undefined ? { text: changes, anchor } : undefined,
    }
  })
}
