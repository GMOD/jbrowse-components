import { parseLocString } from './locString.ts'

import type { Region } from './types/index.ts'

// Only what the parse reads off an assembly, so it stays testable on plain data
// rather than needing a live MST instance. `Assembly` satisfies it.
export interface RefNameSource {
  isValidRefName: (refName: string) => boolean
  getCanonicalRefName2: (refName: string) => string
  regions?: readonly { refName: string; end: number }[]
}

// Parses locstrings a user wrote -- into a dialog's region field, or into a
// display's `clusterRegion` in a session -- to the regions a fetch runs over.
// Throws on an unparsable ref name or an empty range, so a caller surfaces the
// typo rather than quietly running over something else. Whitespace separates
// regions, so a multi-region rubberband selection round-trips through a field,
// and a setting can name more than one locus.
//
// A bare refName means the whole contig, so its length is required, not a
// fallback: defaulting a missing length to 0 turned "this contig has no length
// on record" into "empty region", which reads as the user having typed a bad
// range.
export function locStringsToRegions(
  locStrings: string,
  assembly: RefNameSource,
  assemblyName: string,
): Region[] {
  return locStrings
    .trim()
    .split(/\s+/)
    .map(locString => {
      const parsed = parseLocString(locString, refName =>
        assembly.isValidRefName(refName),
      )
      const refName = assembly.getCanonicalRefName2(parsed.refName)
      // scans rather than calling the assembly's getRegionForRefName, because
      // `RefNameSource` is a narrow duck type several fakes satisfy — growing it
      // a method to save a scan over a list this reads once per typed locstring
      // is the wrong trade
      const refLength = assembly.regions?.find(r => r.refName === refName)?.end
      if (refLength === undefined) {
        throw new Error(`no length on record for "${refName}"`)
      }
      const start = Math.max(parsed.start ?? 0, 0)
      const end = Math.min(parsed.end ?? refLength, refLength)
      if (end <= start) {
        throw new Error(`empty region: "${locString}"`)
      }
      return { assemblyName, refName, start, end }
    })
}
