export interface RenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
  reversed: boolean
}

export function buildRenderBlocks(
  regions: {
    regionNumber: number
    start: number
    end: number
    screenStartPx: number
    screenEndPx: number
    reversed?: boolean
  }[],
): RenderBlock[] {
  return regions.map(r => ({
    regionNumber: r.regionNumber,
    bpRangeX: [r.start, r.end],
    screenStartPx: r.screenStartPx,
    screenEndPx: r.screenEndPx,
    reversed: r.reversed ?? false,
  }))
}
