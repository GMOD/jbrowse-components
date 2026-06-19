import { reducePrecision, sum, toLocale } from './numericUtils.ts'

import type { Region } from './types/index.ts'

export interface MinimalRegion {
  start: number
  end: number
  reversed?: boolean
}

function roundToNearestPointOne(num: number) {
  return Math.round(num * 10) / 10
}

export function bpToPx(
  bp: number,
  {
    reversed,
    end = 0,
    start = 0,
  }: { start?: number; end?: number; reversed?: boolean },
  bpPerPx: number,
) {
  return roundToNearestPointOne((reversed ? end - bp : bp - start) / bpPerPx)
}

export function bpSpanPx(
  leftBp: number,
  rightBp: number,
  region: MinimalRegion,
  bpPerPx: number,
) {
  const start = bpToPx(leftBp, region, bpPerPx)
  const end = bpToPx(rightBp, region, bpPerPx)
  return region.reversed ? ([end, start] as const) : ([start, end] as const)
}

export function featureSpanPx(
  feature: { get: (key: string) => number },
  region: MinimalRegion,
  bpPerPx: number,
) {
  return bpSpanPx(feature.get('start'), feature.get('end'), region, bpPerPx)
}

export function getBpDisplayStr(total: number) {
  if (Math.floor(total / 1_000_000) > 0) {
    return `${reducePrecision(total / 1_000_000)}Mbp`
  } else if (Math.floor(total / 1_000) > 0) {
    return `${reducePrecision(total / 1_000)}Kbp`
  } else {
    return `${Math.floor(total)}bp`
  }
}

export function getTickDisplayStr(totalBp: number, bpPerPx: number) {
  return Math.floor(bpPerPx / 1_000) > 0
    ? `${toLocale(Number.parseFloat((totalBp / 1_000_000).toFixed(2)))}M`
    : toLocale(Math.floor(totalBp))
}

interface VirtualOffset {
  blockPosition: number
}

interface Block {
  minv: VirtualOffset
  maxv: VirtualOffset
}

export async function bytesForRegions(
  regions: Region[],
  index: {
    blocksForRange: (
      ref: string,
      start: number,
      end: number,
    ) => Promise<Block[]>
  },
) {
  const blockResults = await Promise.all(
    regions.map(r => index.blocksForRange(r.refName, r.start, r.end)),
  )
  return sum(
    blockResults
      .flat()
      .map(
        block => block.maxv.blockPosition + 65535 - block.minv.blockPosition,
      ),
  )
}
