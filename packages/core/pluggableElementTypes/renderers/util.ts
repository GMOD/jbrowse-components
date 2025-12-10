import type { Region } from '../../util'

export function normalizeRegion(region: Region): Region {
  return {
    ...region,
    start: Math.floor(region.start),
    end: Math.ceil(region.end),
  }
}

/**
 * Expands a region by a given number of base pairs in both directions.
 * Useful for fetching features that may extend beyond the visible region.
 */
export function expandRegion(region: Region, bpExpansion: number): Region {
  return {
    ...(region as Omit<typeof region, symbol>),
    start: Math.floor(Math.max(region.start - bpExpansion, 0)),
    end: Math.ceil(region.end + bpExpansion),
  }
}
