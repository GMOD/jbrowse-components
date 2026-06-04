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

interface ComputeHighlightBoxesParams {
  view: HighlightView
  laidOutPileupMap: { get(idx: number): PileupDataResult | undefined }
  readIdIndexMap: Map<string, { displayedRegionIndex: number; idx: number }>
  ids: string[]
  height: number
  featureHeightSetting: number
  featureSpacing: number
  topOffset: number
  scrollTop: number
}

interface RegionBounds {
  startBp: number
  endBp: number
  yRow: number
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
    laidOutPileupMap,
    readIdIndexMap,
    ids,
    height,
    featureHeightSetting,
    featureSpacing,
    topOffset,
    scrollTop,
  } = params

  const byRegion = new Map<number, RegionBounds>()
  for (const id of ids) {
    const entry = readIdIndexMap.get(id)
    if (entry) {
      const rpcData = laidOutPileupMap.get(entry.displayedRegionIndex)
      if (rpcData) {
        const startBp = rpcData.readPositions[entry.idx * 2]
        const endBp = rpcData.readPositions[entry.idx * 2 + 1]
        const yRow = rpcData.readYs[entry.idx]
        if (
          startBp !== undefined &&
          endBp !== undefined &&
          yRow !== undefined
        ) {
          const cur = byRegion.get(entry.displayedRegionIndex)
          if (cur) {
            cur.startBp = Math.min(cur.startBp, startBp)
            cur.endBp = Math.max(cur.endBp, endBp)
            cur.yRow = yRow
          } else {
            byRegion.set(entry.displayedRegionIndex, { startBp, endBp, yRow })
          }
        }
      }
    }
  }

  const rowHeight = featureHeightSetting + featureSpacing
  const { bpPerPx } = view
  const boxes: HighlightBox[] = []
  for (const vr of view.visibleRegions) {
    const bounds = byRegion.get(vr.displayedRegionIndex)
    if (bounds) {
      const reversed = vr.reversed ?? false
      const bpEdge = reversed ? vr.end : vr.start
      const bpToPx = (bp: number) =>
        (reversed ? bpEdge - bp : bp - bpEdge) / bpPerPx + vr.screenStartPx
      const x1 = bpToPx(bounds.startBp)
      const x2 = bpToPx(bounds.endBp)
      const top = bounds.yRow * rowHeight - scrollTop + topOffset
      if (top + featureHeightSetting >= topOffset && top <= height) {
        boxes.push({
          left: Math.min(x1, x2),
          top,
          width: Math.abs(x2 - x1),
          height: featureHeightSetting,
        })
      }
    }
  }
  return boxes
}
