import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

export function createCachedABGR() {
  const cache = new Map<string, number>()
  return function getCachedABGR(color: string) {
    let abgr = cache.get(color)
    if (abgr === undefined) {
      abgr = cssColorToABGR(color)
      cache.set(color, abgr)
    }
    return abgr
  }
}
