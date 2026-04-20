export interface RenderBlock {
  displayedRegionIndex: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
  reversed: boolean
}

export function buildRenderBlocks(
  regions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    screenEndPx: number
    reversed?: boolean
  }[],
): RenderBlock[] {
  return regions.map(r => ({
    displayedRegionIndex: r.displayedRegionIndex,
    bpRangeX: [r.start, r.end],
    screenStartPx: r.screenStartPx,
    screenEndPx: r.screenEndPx,
    reversed: r.reversed ?? false,
  }))
}
