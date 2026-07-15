import {
  UnknownRefNameError,
  assembleLocString,
  measureText,
  parseLocString,
} from '@jbrowse/core/util'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'

import type { AssemblyManager, ParsedLocString } from '@jbrowse/core/util'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'

/**
 * Expand a region by a grow factor, adding padding on each side.
 *
 * @param start - region start coordinate
 * @param end - region end coordinate
 * @param grow - multiplier for expansion (e.g., 0.2 adds 20% padding on each
 * side)
 * @param minBound - minimum bound to clamp start to (default 0)
 * @param maxBound - maximum bound to clamp end to (default Infinity)
 * @returns object with expanded start and end coordinates
 */
export function expandRegion(
  start: number,
  end: number,
  grow: number,
  minBound = 0,
  maxBound = Infinity,
) {
  const len = end - start
  const margin = len * grow
  return {
    start: Math.max(minBound, start - margin),
    end: Math.min(maxBound, end + margin),
  }
}

/**
 * Generate tick positions for the overview scalebar. Anchors at the first neat
 * majorPitch multiple strictly inside the block so ticks land on round numbers
 * regardless of where the block starts/ends.
 */
export function makeOverviewTicks(
  start: number,
  end: number,
  bpPerPx: number,
  reversed = false,
) {
  const { majorPitch } = chooseGridPitch(bpPerPx, 120, 15)
  const firstTick = reversed
    ? Math.floor((end - 1) / majorPitch) * majorPitch
    : Math.ceil((start + 1) / majorPitch) * majorPitch
  const numTicks = reversed
    ? Math.floor((firstTick - start - 1) / majorPitch) + 1
    : Math.floor((end - firstTick) / majorPitch) + 1
  return Array.from({ length: Math.max(0, numTicks) }, (_, i) => {
    const genomicCoord = reversed
      ? firstTick - i * majorPitch
      : firstTick + i * majorPitch
    const offsetPx = reversed
      ? (end - genomicCoord) / bpPerPx
      : (genomicCoord - start) / bpPerPx
    return { genomicCoord, offsetPx }
  })
}

export interface Tick {
  type: 'major' | 'minor'
  base: number
}

export function makeTicks(
  start: number,
  end: number,
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
): Tick[] {
  const { majorPitch, minorPitch } = chooseGridPitch(bpPerPx, 60, 15)

  // pad 20px on each side so label ends that spill slightly outside the region
  // still draw
  const margin = 20 * bpPerPx
  const minBase = start - margin + 1
  const maxBase = end + margin + 1

  const iterPitch = minorPitch || majorPitch
  const majorInterval = majorPitch * 2
  const ticks: Tick[] = []
  for (
    let base = Math.floor(minBase / iterPitch) * iterPitch;
    base < Math.ceil(maxBase / iterPitch) * iterPitch + 1;
    base += iterPitch
  ) {
    if (emitMinor && base % majorInterval) {
      ticks.push({ type: 'minor', base: base - 1 })
    } else if (emitMajor && !(base % majorInterval)) {
      ticks.push({ type: 'major', base: base - 1 })
    }
  }
  return ticks
}

/**
 * For blocks in display order, returns whether each block's refName should be
 * labeled: true only for the first block of each run of same-refName regions,
 * so a refName is shown once instead of repeated at every region boundary (e.g.
 * collapsed introns produce many adjacent same-refName regions). Blocks whose
 * getRefName is undefined (non-content) map to false without breaking a run.
 */
/** A block's refName, or undefined for non-content (elided/padding) blocks. */
export function getBlockRefName(block: BaseBlock) {
  return block.type === 'ContentBlock' ? block.refName : undefined
}

export function showRefNameLabels<T>(
  blocks: T[],
  getRefName: (block: T) => string | undefined,
) {
  let prev: string | undefined
  return blocks.map(block => {
    const refName = getRefName(block)
    const show = refName !== undefined && refName !== prev
    if (refName !== undefined) {
      prev = refName
    }
    return show
  })
}

/**
 * Index of the block carrying the "sticky" refName label pinned to the left
 * edge: the rightmost content block whose left edge has scrolled off the left of
 * the viewport, or the first content block when none have.
 */
export function stickyBlockIndex(blocks: BaseBlock[], offsetPx: number) {
  let idx = blocks.findIndex(b => b.type === 'ContentBlock')
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.type === 'ContentBlock' && block.offsetPx < offsetPx) {
      idx = i
    }
  }
  return idx
}

export interface ScalebarRefNameLabel {
  key: string
  refName: string
  displayedRegionIndex: number
  transform: number
  maxWidth: number | undefined
  paddingLeft: number
  text: string
}

/**
 * translateX and maxWidth for one refName label, or undefined when the space
 * before the region ends is too narrow (<20px) to be worth a label (e.g. a tiny
 * collapsed-intron region). Sticky labels start at the viewport's left edge;
 * others start at their block's left edge.
 */
function refLabelLayout(
  block: ContentBlock,
  displayedRegionIndex: number,
  offsetPx: number,
  regionEndPx: Map<number, number>,
  sticky: boolean,
) {
  const regionEnd = regionEndPx.get(displayedRegionIndex)
  const transform = sticky
    ? Math.max(0, -offsetPx)
    : block.offsetPx - offsetPx - 1
  // block-frame x where the label actually starts. Derived from `transform` (=
  // transform + offsetPx) so the width-to-region-end clip stays in lockstep
  // with where the label is drawn: a sticky label pins to the region's left
  // edge, not the viewport's, whenever the view is left-overscrolled
  // (offsetPx < 0) — reading offsetPx directly there over-counted the available
  // width by |offsetPx|, letting the name bleed past its region's right edge.
  const labelStartPx = transform + offsetPx
  // A non-sticky label's transform anchors at the same x as the region
  // divider drawn just to its left (SVGRegionSeparators, a 3px bar spanning
  // local [0,3] from this same block.offsetPx edge), so paddingLeft must clear
  // that bar plus a few px of breathing room, else the text visually touches
  // the divider. Sticky labels sit at the viewport's own left edge, no divider.
  const paddingLeft = sticky ? 0 : 7
  const maxWidth =
    regionEnd === undefined
      ? undefined
      : regionEnd - labelStartPx - paddingLeft - 1
  if (maxWidth !== undefined && maxWidth < 20) {
    return undefined
  }
  return { transform, maxWidth, paddingLeft }
}

/**
 * Builds the refName labels drawn along the scalebar as plain data (no JSX): one
 * label per run of same-refName regions (deduped so collapsed introns don't
 * repeat the name) plus a "sticky" label pinned to the left edge naming the
 * refName under the viewport's left border. `prefix` (an assembly name, synteny
 * only) folds into the sticky label as "prefix:refName"; showPrefixFallback
 * flags that it must instead be drawn standalone because no sticky label carried
 * it (e.g. the leftmost region was too narrow to label).
 */
export function getScalebarRefNameLabels({
  blocks,
  offsetPx,
  regionEndPx,
  prefix,
}: {
  blocks: BaseBlock[]
  offsetPx: number
  regionEndPx: Map<number, number>
  prefix: string | undefined
}) {
  const hasPrefix = prefix !== undefined && prefix !== ''
  const stickyIdx = stickyBlockIndex(blocks, offsetPx)
  const isRunStart = showRefNameLabels(blocks, getBlockRefName)
  const labels: ScalebarRefNameLabel[] = []
  let stickyHasPrefix = false

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    const sticky = i === stickyIdx
    const show =
      sticky || (!!block.isLeftEndOfDisplayedRegion && isRunStart[i]!)
    if (
      block.type !== 'ContentBlock' ||
      block.displayedRegionIndex === undefined ||
      !show
    ) {
      continue
    }
    const idx = block.displayedRegionIndex
    const layout = refLabelLayout(block, idx, offsetPx, regionEndPx, sticky)
    if (!layout) {
      continue
    }
    const withPrefix = sticky && hasPrefix
    stickyHasPrefix ||= withPrefix
    labels.push({
      key: block.key,
      refName: block.refName,
      displayedRegionIndex: idx,
      transform: layout.transform,
      maxWidth: layout.maxWidth,
      paddingLeft: layout.paddingLeft,
      text: withPrefix ? `${prefix}:${block.refName}` : block.refName,
    })
  }
  return { labels, showPrefixFallback: hasPrefix && !stickyHasPrefix }
}

/**
 * Which reorder actions the refName-label menu should offer for the region at
 * `idx` of `numRegions`. The "far" moves are gated on there being a gap of more
 * than one between `idx` and the end — otherwise "Move to far left/right" would
 * target the same index as "Move left/right" and duplicate the entry.
 */
export function regionMoveActions(idx: number, numRegions: number) {
  return {
    canMoveLeft: idx > 0,
    canMoveRight: idx < numRegions - 1,
    canMoveFarLeft: idx > 1,
    canMoveFarRight: idx < numRegions - 2,
  }
}

/**
 * Whether a label occupying [leftPx, leftPx + labelWidth] fits within a block
 * of the given pixel width, used to skip tick labels that would be clipped at a
 * region edge (common with small collapsed-intron regions).
 */
export function labelFitsInBlock(
  leftPx: number,
  labelWidth: number,
  widthPx: number,
) {
  return leftPx >= 0 && leftPx + labelWidth <= widthPx
}

/**
 * On-screen width of a coordinate tick label: the 11px text plus 2px of
 * horizontal padding on each side. Single-sourced so the HTML scalebar and the
 * SVG export agree on when a label is too wide to fit inside its block.
 */
export function tickLabelWidth(label: string) {
  return measureText(label, 11) + 4
}

/** Font size of the bold overview-scalebar refName label, drawn at the left
 * edge of its block. */
export const REF_NAME_LABEL_FONT_SIZE = 11

/** Left inset of the overview refName label within its block. */
const REF_NAME_LABEL_INSET_PX = 3

/**
 * Horizontal space the overview refName label occupies at a block's left edge.
 * Overview tick labels use this to avoid drawing underneath the refName, which
 * otherwise collide when zoomed far out (ticks bunch up near the block start).
 */
export function overviewRefNameLabelWidth(refName: string) {
  return (
    REF_NAME_LABEL_INSET_PX +
    measureText(refName, REF_NAME_LABEL_FONT_SIZE) +
    REF_NAME_LABEL_INSET_PX
  )
}

/**
 * A maximal run of adjacent staticBlocks that belong to one contiguous
 * displayed region. staticBlocks chop a region into ~800px chunks; merging them
 * back means a coordinate label sitting on an internal chunk boundary is no
 * longer clipped away by both neighbors (only genuine region edges clip).
 */
export interface BlockRun {
  offsetPx: number
  widthPx: number
  start: number
  end: number
  reversed: boolean
}

export function groupContiguousBlocks(blocks: BaseBlock[]) {
  const runs: BlockRun[] = []
  let current: BlockRun | undefined
  let currentRegionIndex: number | undefined
  for (const block of blocks) {
    if (block.type === 'ContentBlock') {
      if (
        current !== undefined &&
        currentRegionIndex === block.displayedRegionIndex
      ) {
        current.widthPx += block.widthPx
        current.start = Math.min(current.start, block.start)
        current.end = Math.max(current.end, block.end)
      } else {
        current = {
          offsetPx: block.offsetPx,
          widthPx: block.widthPx,
          start: block.start,
          end: block.end,
          reversed: !!block.reversed,
        }
        currentRegionIndex = block.displayedRegionIndex
        runs.push(current)
      }
    } else {
      current = undefined
      currentRegionIndex = undefined
    }
  }
  return runs
}

/**
 * makeTicks plus each tick's pixel x within its block, accounting for reversed
 * regions. Single source of the tick→px formula shared by gridlines, the
 * scalebar coordinate labels, and SVG export so their positions can't drift.
 */
export function makeBlockTicks(
  {
    start,
    end,
    reversed = false,
  }: { start: number; end: number; reversed?: boolean },
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  return makeTicks(start, end, bpPerPx, emitMajor, emitMinor).map(tick => ({
    ...tick,
    x: (reversed ? end - tick.base : tick.base - start) / bpPerPx,
  }))
}

/**
 * Generate location objects for a set of parsed locstrings, which includes
 * translating the refNames to assembly-canonical refNames and adding the
 * 'parentRegion'
 *
 * Used by navToLocations and navToLocString
 *
 * @param regions - array of parsed location strings to generate locations for
 * @param assemblyManager - the assembly manager instance
 * @param assemblyName - optional assembly name to use for regions that don't
 * specify one
 * @param grow - optional multiplier to expand regions by (e.g., 0.2 adds 20%
 * padding on each side of the region). Useful for adding visual padding when
 * navigating to a feature
 */
export async function generateLocations({
  regions,
  assemblyManager,
  assemblyName,
  grow,
}: {
  regions: ParsedLocString[]
  assemblyManager: AssemblyManager
  assemblyName?: string
  grow?: number
}) {
  return Promise.all(
    regions.map(async region => {
      const asmName = region.assemblyName || assemblyName
      if (!asmName) {
        throw new Error('no assembly provided')
      }
      const asm = await assemblyManager.waitForAssembly(asmName)
      const { refName } = region
      if (!asm) {
        throw new Error(`assembly ${asmName} not found`)
      }
      const { regions } = asm
      if (!regions) {
        throw new Error(`regions not loaded yet for ${asmName}`)
      }
      const canonicalRefName = asm.getCanonicalRefName(refName)
      if (!canonicalRefName) {
        throw new Error(`Could not find refName ${refName} in ${asm.name}`)
      }
      const parentRegion = regions.find(r => r.refName === canonicalRefName)
      if (!parentRegion) {
        throw new Error(`Could not find refName ${refName} in ${asmName}`)
      }

      const { start, end } = region
      const expanded =
        grow && start !== undefined && end !== undefined
          ? expandRegion(start, end, grow)
          : undefined
      return {
        ...region,
        ...(expanded ? { start: expanded.start, end: expanded.end } : {}),
        assemblyName: asmName,
        parentRegion,
      }
    }),
  )
}

/**
 * Parses locString or space separated set of locStrings into location objects
 * Example inputs:
 * "chr1"
 * "chr1:1-100"
 * "chr1:1..100"
 * "chr1 chr2"
 * "chr1:1-100 chr2:1-100"
 * "chr1 100 200" equivalent to "chr1:1-100"
 *
 * Used by navToLocString
 */
export function parseLocStrings(
  input: string,
  assemblyName: string,
  isValidRefName: (str: string, assemblyName: string) => boolean,
) {
  const inputs = input
    .split(/(\s+)/)
    .map(f => f.trim())
    .filter(f => !!f)
  // first try interpreting as a whitespace-separated sequence of
  // multiple locstrings
  try {
    return inputs.map(loc =>
      parseLocString(loc, ref => isValidRefName(ref, assemblyName)),
    )
  } catch (e) {
    // if this fails, try interpreting as a whitespace-separated refname,
    // start, end if start and end are integer inputs
    const [refName, start, end] = inputs
    if (
      e instanceof UnknownRefNameError &&
      Number.isInteger(+start!) &&
      Number.isInteger(+end!)
    ) {
      return [
        parseLocString(`${refName}:${start}..${end}`, ref =>
          isValidRefName(ref, assemblyName),
        ),
      ]
    }
    throw e
  }
}

export function calculateVisibleLocStrings(contentBlocks: ContentBlock[]) {
  if (!contentBlocks.length) {
    return ''
  }
  const isSingleAssemblyName = contentBlocks.every(
    b => b.assemblyName === contentBlocks[0]!.assemblyName,
  )
  return contentBlocks
    .map(block =>
      assembleLocString({
        refName: block.refName,
        start: Math.round(block.start),
        end: Math.round(block.end),
        assemblyName: isSingleAssemblyName ? undefined : block.assemblyName,
        reversed: block.reversed,
      }),
    )
    .join(' ')
}
