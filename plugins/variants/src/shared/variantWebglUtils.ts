import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

const abgrCache = new Map<string, number>()

export function getCachedABGR(color: string) {
  let abgr = abgrCache.get(color)
  if (abgr === undefined) {
    abgr = cssColorToABGR(color)
    abgrCache.set(color, abgr)
  }
  return abgr
}
