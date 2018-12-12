import { openUrl } from './io/rangeFetcher'
import LocalFile from './io/localFile'

export function assembleLocString({ assembly, refName, start, end }) {
  return `${assembly}:${refName}:${start + 1}-${end}`
}

export function openLocation(location) {
  if (!location) throw new Error(`must provide a location to openLocation`)
  if (location.uri) return openUrl(location.uri)
  if (location.path) {
    return new LocalFile(location.path)
  }
  throw new Error('local files not yet supported by openLocation')
}

export function clamp(val, min, max) {
  if (val < min) return min
  if (val > max) return max
  return val
}

export function bpToPx(bp, region, bpPerPx, flipped = false) {
  if (flipped) {
    return (region.end - bp) / bpPerPx
  }
  return (bp - region.start) / bpPerPx
}
