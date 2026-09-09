import { inkOfInstances } from '@jbrowse/render-core/marks'

import { segmentsOfRead } from '../../features/read/hitTest.ts'
import { READ_MARK } from '../../features/read/mark.ts'
import { bandScreenTop, sectionBandBottom } from './sectionScreen.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
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
  region: number
  data: PileupDataResult
  instances: MarkInstance[]
}

// A spliced read's segments, and a chain's members, share a row: their boxes
// in one region merge into the one span the eye reads as the read or the
// chain — intron and the gap between mates included.
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
 * The boxes the hovered read, or the hovered chain's reads, painted: each
 * read is its exon segments through the read mark's ink, placed by the
 * section's own pileup top, clipped to the section's band on screen the way
 * the renderer scissors it, and merged per row. `strong` marks a chain's
 * heavier shade.
 */
export function readHighlightInk({
  blocks,
  sections,
  readIdIndexMap,
  ids,
  state,
  scroll,
  strong,
}: {
  blocks: readonly RenderBlock[]
  sections: readonly HighlightSection[]
  readIdIndexMap: ReadonlyMap<
    string,
    { displayedRegionIndex: number; groupKey: string; idx: number }
  >
  ids: readonly string[]
  state: RenderState
  scroll: ScrollModel
  strong: boolean
}): HighlightRect[] {
  const sectionByGroup = new Map(sections.map(s => [s.groupKey, s]))
  const lit = new Map<string, Lit>()
  for (const id of ids) {
    const entry = readIdIndexMap.get(id)
    const section = entry && sectionByGroup.get(entry.groupKey)
    const data = section?.laidOutPileupMap.get(entry!.displayedRegionIndex)
    if (!entry || !section || !data) {
      continue
    }
    const key = `${entry.groupKey}\0${entry.displayedRegionIndex}`
    let group = lit.get(key)
    if (!group) {
      group = {
        section,
        region: entry.displayedRegionIndex,
        data,
        instances: [],
      }
      lit.set(key, group)
    }
    const { first, last } = segmentsOfRead(data.segmentReadIndices, entry.idx)
    for (let s = first; s < last; s++) {
      group.instances.push({ mark: 0, index: s })
    }
  }
  const boxes: HighlightRect[] = []
  for (const { section, region, data, instances } of lit.values()) {
    const bandTop = bandScreenTop(section.topOffset, scroll)
    const bandBottom = sectionBandBottom(
      section.topOffset,
      section.pileupHeight,
      scroll,
    )
    const rects = inkOfInstances(
      [READ_MARK],
      blocks,
      idx => (idx === region ? data : undefined),
      { ...state, pileupTopOffset: section.topOffset },
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
