import {
  bandScreenTop,
  contentScreenY,
  makeBpToPx,
  makeScroll,
  sectionBandBottom,
} from './sectionScreen.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

export interface HighlightBox {
  left: number
  top: number
  width: number
  height: number
}

interface HighlightView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

// One stacked group's data + its pileup-row top offset (screen px, pre-scroll).
// Ungrouped is a single section (groupKey '') with topOffset coverageDisplayHeight.
// `pileupHeight` is the section's pileup band height; collapsed groups have 0,
// so their highlight boxes clip away instead of bleeding into the next section.
export interface HighlightSection {
  groupKey: string
  laidOutPileupMap: { get(idx: number): PileupDataResult | undefined }
  topOffset: number
  pileupHeight: number
}

interface ComputeHighlightBoxesParams {
  view: HighlightView
  sections: HighlightSection[]
  readIdIndexMap: Map<
    string,
    { displayedRegionIndex: number; groupKey: string; idx: number }
  >
  ids: string[]
  height: number
  featureHeight: number
  featureSpacing: number
  scrollTop: number
}

interface RegionBounds {
  startBp: number
  endBp: number
  yRow: number
  topOffset: number
  pileupHeight: number
}

// Screen-space boxes for the hovered read (one id) or hovered chain (its member
// ids share one row, so they collapse to a single span per region). Lives in a
// React overlay rather than the canvas renderState so a hover change repaints
// only this div, not the whole pileup — see the renderState getter.
export function computeHighlightBoxes(
  params: ComputeHighlightBoxesParams,
): HighlightBox[] {
  const {
    view,
    sections,
    readIdIndexMap,
    ids,
    height,
    featureHeight,
    featureSpacing,
    scrollTop,
  } = params

  const sectionByGroup = new Map(sections.map(s => [s.groupKey, s]))

  // Collapse ids that share a row into one span, keyed per (group, region):
  // chain members live in one group, and the topOffset is the group's section.
  const byKey = new Map<
    string,
    RegionBounds & { displayedRegionIndex: number }
  >()
  for (const id of ids) {
    const entry = readIdIndexMap.get(id)
    const section = entry && sectionByGroup.get(entry.groupKey)
    if (entry && section) {
      const rpcData = section.laidOutPileupMap.get(entry.displayedRegionIndex)
      if (rpcData) {
        const startBp = rpcData.readPositions[entry.idx * 2]
        const endBp = rpcData.readPositions[entry.idx * 2 + 1]
        const yRow = rpcData.readYs[entry.idx]
        if (
          startBp !== undefined &&
          endBp !== undefined &&
          yRow !== undefined
        ) {
          const mapKey = `${entry.groupKey}\0${entry.displayedRegionIndex}`
          const cur = byKey.get(mapKey)
          if (cur) {
            cur.startBp = Math.min(cur.startBp, startBp)
            cur.endBp = Math.max(cur.endBp, endBp)
            cur.yRow = yRow
          } else {
            byKey.set(mapKey, {
              startBp,
              endBp,
              yRow,
              topOffset: section.topOffset,
              pileupHeight: section.pileupHeight,
              displayedRegionIndex: entry.displayedRegionIndex,
            })
          }
        }
      }
    }
  }

  const rowHeight = featureHeight + featureSpacing
  const { bpPerPx } = view
  const boxes: HighlightBox[] = []
  // See sectionScreen.ts for the band-top-vs-content scroll tiers: a row is
  // content (always scrolls), the section ceiling is a sticky-capable band top.
  const scroll = makeScroll(sections.length, scrollTop, height)
  for (const vr of view.visibleRegions) {
    const bpToPx = makeBpToPx(vr, bpPerPx)
    for (const bounds of byKey.values()) {
      if (bounds.displayedRegionIndex !== vr.displayedRegionIndex) {
        continue
      }
      const x1 = bpToPx(bounds.startBp)
      const x2 = bpToPx(bounds.endBp)
      const top = contentScreenY(
        bounds.yRow * rowHeight + bounds.topOffset,
        scroll,
      )
      const bottom = sectionBandBottom(
        bounds.topOffset,
        bounds.pileupHeight,
        scroll,
      )
      const sectionTop = bandScreenTop(bounds.topOffset, scroll)
      // Strict `<`: a collapsed group has a zero-height band (bottom ==
      // sectionTop), so its row anchored at sectionTop must not draw a box.
      if (top + featureHeight >= sectionTop && top < bottom) {
        boxes.push({
          left: Math.min(x1, x2),
          top,
          width: Math.abs(x2 - x1),
          height: featureHeight,
        })
      }
    }
  }
  return boxes
}
