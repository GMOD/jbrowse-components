import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'

import { frameOpenings, laneBpOfOpened } from './layoutMultiWay.ts'

import type { Lane } from './laneStack.ts'

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
): LaneHeaderRow[] {
  const inline = inlineGlyphHeight !== undefined
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
    return {
      assemblyName: lane.assemblyName,
      label: inline
        ? `${lane.label}${lane.frame?.flipped ? ' [rev]' : ''}`
        : [lane.label, where, alsoOn].filter(part => !!part).join('  '),
      scale: scaleLabelOf(lane, visibleBpSpan),
      y: inline
        ? inlineBaseline(lane.glyphTop, inlineGlyphHeight)
        : lane.layerTop - LABEL_BASELINE_OFFSET,
      isAnchor: lane.isAnchor,
      inline,
    }
  })
}
