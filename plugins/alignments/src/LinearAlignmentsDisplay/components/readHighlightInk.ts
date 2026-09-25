import { inkOfInstances } from '@jbrowse/render-core/marks'

import { segmentsOfRead } from '../../features/read/hitTest.ts'
import { READ_MARK } from '../../features/read/mark.ts'
import { pileupRowY } from '../renderers/rendererTypes.ts'
import { bandScreenTop, sectionBandBottom } from './sectionScreen.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ReadSlot } from '../../shared/readSlot.ts'
import type { RenderState } from '../renderers/rendererTypes.ts'
import type { ScrollModel } from './sectionScreen.ts'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { MarkInstance } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * One stacked group and its pileup band's content-space top; the ungrouped
 * display is one section keyed `''`. A collapsed group's `pileupHeight` is 0,
 * so its rows clip to nothing rather than bleeding into the next section.
 */
export interface HighlightSection {
  groupKey: string
  laidOutPileupMap: { get(idx: number): PileupDataResult | undefined }
  topOffset: number
  pileupHeight: number
}

interface Lit {
  section: HighlightSection
  frame: RenderState
  bandTop: number
  bandBottom: number
  region: number
  data: PileupDataResult
  instances: MarkInstance[]
}

// A spliced read's segments merge into the one span the eye reads as the read,
// intron included, and a chain's members on a row into the chain. Plain reads
// merge only with themselves: a pileup row holds reads that were not lit.
function mergeRow(rects: HighlightRect[]) {
  const byTop = new Map<number, HighlightRect>()
  for (const r of rects) {
    const cur = byTop.get(r.top)
    if (cur) {
      const left = Math.min(cur.left, r.left)
      cur.width = Math.max(cur.left + cur.width, r.left + r.width) - left
      cur.left = left
    } else {
      byTop.set(r.top, { ...r })
    }
  }
  return [...byTop.values()]
}

/**
 * Which reads a hover or a selection lights, and in which shade. The chain
 * list outside chain mode is a connector's two ends, which light in the plain
 * shade a read hover takes; only a chain takes the strong one.
 */
export function readsToLight({
  isChainMode,
  chainReadIds,
  readId,
}: {
  isChainMode: boolean
  chainReadIds: readonly string[]
  readId: string | undefined
}): { ids: readonly string[]; strong: boolean } {
  return chainReadIds.length > 0
    ? { ids: chainReadIds, strong: isChainMode }
    : { ids: readId ? [readId] : [], strong: false }
}

/**
 * The slots of the named reads, one region's copy each, as `readIdIndexMap`
 * holds them.
 */
export function slotsOfIds(
  ids: readonly string[],
  readIdIndexMap: ReadonlyMap<string, ReadSlot>,
) {
  const slots: ReadSlot[] = []
  for (const id of ids) {
    const slot = readIdIndexMap.get(id)
    if (slot) {
      slots.push(slot)
    }
  }
  return slots
}

/**
 * The boxes the hovered read, or the hovered chain's reads, painted: each
 * read is its exon segments through the read mark's ink, placed by the
 * section's own pileup top, clipped to the section's band on screen the way
 * the renderer scissors it, and merged per read, or per row for a chain.
 * `strong` marks a chain's heavier shade.
 */
export function readHighlightInk({
  blocks,
  sections,
  slots,
  state,
  scroll,
  strong,
}: {
  blocks: readonly RenderBlock[]
  sections: readonly HighlightSection[]
  slots: Iterable<ReadSlot>
  state: RenderState
  scroll: ScrollModel
  strong: boolean
}): HighlightRect[] {
  const sectionByGroup = new Map(
    sections.map(s => [
      s.groupKey,
      {
        section: s,
        frame: { ...state, pileupTopOffset: s.topOffset },
        bandTop: bandScreenTop(s.topOffset, scroll),
        bandBottom: sectionBandBottom(s.topOffset, s.pileupHeight, scroll),
      },
    ]),
  )
  const chains = new Map<string, Lit>()
  const reads: Lit[] = []
  for (const entry of slots) {
    const host = sectionByGroup.get(entry.groupKey)
    const data = host?.section.laidOutPileupMap.get(entry.displayedRegionIndex)
    if (!host || !data) {
      continue
    }
    // a lit set can be thousands of reads, most on rows scrolled out of the
    // band, so those are dropped before anything is built for them
    const y = pileupRowY(data.readYs[entry.idx]!, host.frame)
    if (y + state.featureHeight <= host.bandTop || y >= host.bandBottom) {
      continue
    }
    const chainKey = strong
      ? `${entry.groupKey}\0${entry.displayedRegionIndex}`
      : ''
    let group = strong ? chains.get(chainKey) : undefined
    if (!group) {
      group = {
        ...host,
        region: entry.displayedRegionIndex,
        data,
        instances: [],
      }
      if (strong) {
        chains.set(chainKey, group)
      } else {
        reads.push(group)
      }
    }
    const { first, last } = segmentsOfRead(data.segmentReadIndices, entry.idx)
    for (let s = first; s < last; s++) {
      group.instances.push({ mark: 0, index: s })
    }
  }
  const boxes: HighlightRect[] = []
  for (const { frame, bandTop, bandBottom, region, data, instances } of strong
    ? chains.values()
    : reads) {
    const rects = inkOfInstances(
      [READ_MARK],
      blocks,
      idx => (idx === region ? data : undefined),
      frame,
      idx => (idx === region ? instances : undefined),
    )
    const clipped: HighlightRect[] = []
    for (const r of rects) {
      const top = Math.max(r.top, bandTop)
      const bottom = Math.min(r.top + r.height, bandBottom)
      if (bottom > top) {
        clipped.push({ ...r, top, height: bottom - top, strong })
      }
    }
    boxes.push(...mergeRow(clipped))
  }
  return boxes
}
