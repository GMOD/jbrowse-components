import type { Region } from '@jbrowse/core/util'

// coordinates too, not just refNames: T2T-CHM13 and GRCh38 share a refName list
export function sameCircularRegions(a: Region[], b: Region[]) {
  return (
    a.length === b.length &&
    a.every((r, i) => {
      const o = b[i]!
      return (
        r.refName === o.refName &&
        r.start === o.start &&
        r.end === o.end &&
        r.assemblyName === o.assemblyName
      )
    })
  )
}
