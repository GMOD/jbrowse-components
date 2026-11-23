import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'

import { laneOf } from './copyLane.ts'
import {
  SPLIT_AT_GAP_BP,
  frameOpenings,
  laneBpOfOpened,
} from './layoutMultiWay.ts'

import type { Lane } from './laneStack.ts'
import type { LaneBlock, LaneChange, LaneRepeat } from './layoutMultiWay.ts'

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
  /** the deletions, insertions, replacements and inversions against the anchor the shown frame meets */
  changes?: { text: string; anchor: string }
  /** the stretches the shown frame meets whose copies no ribbon pairs, the largest named and its walks as a hover title */
  repeats?: { text: string; title: string }
  /** the swatch beside the label and its tint: the lane's `rows.colors` entry, else its source's color */
  color?: string
}

const LISTED_CHANGES = 2

const MIN_CHANGE_PAD_BP = 1000

function bpText(n: number) {
  const figures = n >= 100_000 ? 3 : 2
  return n >= 1_000_000
    ? `${Number((n / 1_000_000).toPrecision(figures))} Mb`
    : n >= 1000
      ? `${Number((n / 1000).toPrecision(figures))} kb`
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

function changeBp({ anchorBp, laneBp, kind }: LaneChange) {
  return kind === 'inversion' ? anchorBp : Math.max(anchorBp, laneBp)
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
          ({ at, laneEnd }) => at <= region.end && laneEnd >= region.start,
        )
        .toSorted((a, b) => changeBp(b) - changeBp(a))
    : []
}

export function changeLabel(change: LaneChange) {
  const { anchorBp, laneBp, kind } = change
  return kind === 'replacement'
    ? `${bpText(anchorBp)} replaced by ${bpText(laneBp)}`
    : `${bpText(changeBp(change))} ${kind}`
}

/** the anchor a change sits on, padded by half its size either side */
export function changeWindow(change: LaneChange) {
  const { anchor } = change
  const pad = Math.max(Math.round(changeBp(change) / 2), MIN_CHANGE_PAD_BP)
  return {
    refName: anchor.refName,
    start: Math.max(0, anchor.start - pad),
    end: anchor.end + pad,
  }
}

function walkTimes(walks: number) {
  const times = walks >= 10 ? Math.round(walks) : Number(walks.toFixed(1))
  return times === 1 ? 'once' : times === 2 ? 'twice' : `${times} times`
}

/**
 * The chip naming a lane's array records the shown frame meets: the one
 * holding the most lane bp, the rest counted, and how often each side walks
 * its sequence as a hover title
 */
export function repeatsChip(
  lane: Pick<Lane, 'frame' | 'canon' | 'label'>,
  stated: readonly LaneRepeat[],
  anchor: string,
) {
  const region = laneRegion(lane)
  const shown = region
    ? stated
        .filter(
          ({ at, laneBp }) => at <= region.end && at + laneBp >= region.start,
        )
        .toSorted((a, b) => b.laneBp - a.laneBp || b.anchorBp - a.anchorBp)
    : []
  const largest = shown[0]
  const more = shown.length - 1
  return largest
    ? {
        text: `${bpText(largest.laneBp)} repeat over ${bpText(largest.anchorBp)}${more ? `, ${more} more` : ''}`,
        title: `This stretch repeats: ${lane.label} passes its sequence about ${walkTimes(largest.laneWalks)} and ${anchor} about ${walkTimes(largest.anchorWalks)}, so no single ribbon is drawn.`,
      }
    : undefined
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

export function changesTitle(anchor: string) {
  return `Changes against ${anchor} of ${bpText(SPLIT_AT_GAP_BP)} or more. Not listed: smaller ones, and any gap holding a piece of the other strand, such as an inversion's breakpoints.`
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
  const { frame } = lane
  const laneSpan = frame ? frame.max - frame.min : 0
  const multiple = visibleBpSpan > 0 ? laneSpan / visibleBpSpan : 1
  const times = `${Number(multiple.toFixed(1))}×`
  return lane.isAnchor
    ? visibleBpSpan > 0
      ? {
          text: getBpDisplayStr(visibleBpSpan),
          title:
            'The span of the window. Other lanes share this scale unless marked squeezed.',
        }
      : { text: '' }
    : multiple > 1.02
      ? {
          text: `squeezed ${times}`,
          title: `This lane is drawn ${times} smaller than the ruler.`,
        }
      : { text: '' }
}

function allReversed(lane: Lane) {
  const orientations = [...lane.placements.values()].flatMap(
    group => group.orientations,
  )
  return (
    !lane.isAnchor &&
    orientations.length > 0 &&
    orientations.every(orientation => orientation < 0)
  )
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
  repeatsOf: (
    assemblyName: string,
    refName: string,
  ) => readonly LaneRepeat[] = () => [],
  /** the stretch of a lane's contig matched to the window, which the label names */
  matchedOf: (lane: Lane) => { start: number; end: number } | undefined = () =>
    undefined,
  /** whether a lane is drawn against the anchor's order */
  drawnFlippedOf: (lane: Lane) => boolean = () => false,
): LaneHeaderRow[] {
  const inline = inlineGlyphHeight !== undefined
  const anchor = lanes.find(lane => lane.isAnchor)?.label
  const strandOf = (lane: Lane) =>
    [
      allReversed(lane) ? `reversed vs ${anchor ?? 'the anchor'}` : undefined,
      drawnFlippedOf(lane) ? 'drawn flipped' : undefined,
    ].filter(part => !!part)
  return lanes.map(lane => {
    const matched = lane.frame && matchedOf(lane)
    const region = lane.frame &&
      matched && { refName: lane.canon(lane.frame.refName), ...matched }
    const loc = region && assembleLocString(region)
    // a copy lane's label names its contig already
    const shownRegion =
      region && laneOf(lane.assemblyName).refName !== undefined
        ? loc?.slice(region.refName.length + 1)
        : loc
    const where = lane.isAnchor
      ? anchorWhere
      : lane.frame &&
        [shownRegion, ...strandOf(lane)].filter(part => !!part).join(' ')
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
    const repeats =
      frame && anchor !== undefined
        ? repeatsChip(lane, repeatsOf(lane.assemblyName, frame.refName), anchor)
        : undefined
    const scale = scaleOf(lane, visibleBpSpan)
    return {
      assemblyName: lane.assemblyName,
      label: inline
        ? [lane.label, ...(lane.frame ? strandOf(lane) : [])].join(' ')
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
      ...(repeats ? { repeats } : {}),
      color: colorOf(lane.assemblyName),
    }
  })
}
