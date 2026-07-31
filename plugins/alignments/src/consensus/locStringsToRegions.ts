import { parseLocString } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

// Only what the parse reads off an assembly, so it stays testable on plain data
// rather than needing a live MST instance. `Assembly` satisfies it.
export interface RefNameSource {
  isValidRefName: (refName: string) => boolean
  getCanonicalRefName2: (refName: string) => string
  regions?: readonly { refName: string; end: number }[]
}

// Parses what the user typed into the dialog's region field. Throws on an
// unparsable ref name or an empty range, and the dialog surfaces that rather
// than fetching. Whitespace separates regions, so a multi-region rubberband
// selection round-trips through the field.
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
