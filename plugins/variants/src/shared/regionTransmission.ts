import { transmissionEntriesFor } from '@jbrowse/core/assemblyManager'

import type { TransmissionEntry } from '@jbrowse/core/assemblyManager'

/**
 * Each region's transmission rule: the assembly's `entries` that hold for
 * its refName, resolved through the assembly's aliases on the main thread,
 * since a worker has no assembly to resolve them against.
 */
export function regionTransmission<T extends TransmissionEntry>(
  entries: readonly T[],
  regions: readonly { refName: string }[],
  assembly: { getCanonicalRefName2: (refName: string) => string },
) {
  return regions.map(region =>
    transmissionEntriesFor(entries, region.refName, assembly),
  )
}
