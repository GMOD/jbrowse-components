import type { Region } from '../../util'

export function normalizeRegion(region: Region): Region {
  return {
    ...region,
    start: Math.floor(region.start),
    end: Math.ceil(region.end),
  }
}
