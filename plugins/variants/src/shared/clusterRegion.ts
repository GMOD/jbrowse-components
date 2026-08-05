import { parseLocString } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

// Only what the parse reads off an assembly, so it stays testable on plain data
// rather than needing a live MST instance. `Assembly` satisfies it.
export interface ClusterRegionAssembly {
  isValidRefName: (refName: string) => boolean
  getCanonicalRefName2: (refName: string) => string
  regions?: readonly { refName: string; end: number }[]
}

// Resolves a display's `clusterRegion` locstring to the regions the clustering
// RPC runs over, so "cluster here" can be said in a session instead of driven
// through the location box.
//
// It is a locstring rather than a Region object because that is what a user
// types and what every other declarative launch spec in the app takes; and it
// takes several, whitespace-separated, because the clustering estimator already
// accepts a region list (the visible blocks are one) and a multi-region view is
// the case where "the region I care about" is genuinely more than one span.
//
// Throws rather than falling back to the visible region: a locstring with a
// typo in it would otherwise cluster over whatever happened to be on screen and
// look like it worked.
export function parseClusterRegion(
  locStrings: string,
  assembly: ClusterRegionAssembly,
  assemblyName: string,
): Region[] {
  return locStrings
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(locString => {
      const parsed = parseLocString(locString, refName =>
        assembly.isValidRefName(refName),
      )
      const refName = assembly.getCanonicalRefName2(parsed.refName)
      // A bare refName means the whole contig, so its length is required rather
      // than defaulted: a missing length would turn "no length on record" into
      // an empty region, which reads as the user having typed a bad range.
      const refLength = assembly.regions?.find(r => r.refName === refName)?.end
      if (refLength === undefined) {
        throw new Error(`no length on record for "${refName}"`)
      }
      const start = Math.max(parsed.start ?? 0, 0)
      const end = Math.min(parsed.end ?? refLength, refLength)
      if (end <= start) {
        throw new Error(`empty clusterRegion: "${locString}"`)
      }
      return { assemblyName, refName, start, end }
    })
}
