import { parseLocString } from '@jbrowse/core/util'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Region } from '@jbrowse/core/util'

// Parses what the user typed into the dialog's region field. Throws on an
// unparsable ref name or an empty range, and the dialog surfaces that rather
// than fetching. Whitespace separates regions, so a multi-region rubberband
// selection round-trips through the field.
export function locStringsToRegions(
  locStrings: string,
  assembly: Assembly,
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
      const start = Math.max(parsed.start ?? 0, 0)
      const end = Math.min(parsed.end ?? refLength ?? 0, refLength ?? 0)
      if (end <= start) {
        throw new Error(`empty region: "${locString}"`)
      }
      return { assemblyName, refName, start, end }
    })
}
