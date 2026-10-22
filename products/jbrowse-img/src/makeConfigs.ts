import path from 'node:path'

import { makeLocation, syntenyFlags, trackFlags } from '@jbrowse/launch-args'

import type { Assembly, Track } from './types.ts'

export { makeLocation }

export const trackTypes: string[] = [...trackFlags, 'multiwig']

export const syntenyTrackTypes: string[] = syntenyFlags

// Build a MultiQuantitativeTrack from a `--multiwig` sources list. A plain array
// of BigWig path/URL strings becomes one BigWigAdapter subadapter each, with the
// location run through makeLocation so a LOCAL path works as well as a URL — the
// adapter's own `bigWigs` shorthand can only express URIs, so a bare local path
// would 404 there. The subtrack name still derives from the filename (the
// adapter falls back to the bigWigLocation basename when a subadapter carries no
// explicit name), matching the shorthand. An array of subadapter objects (each a
// BigWigAdapter config carrying its own name/color/group) passes through as
// `subadapters`, so a curated multi-sample track keeps its per-row metadata.
export function makeMultiWiggleTrackConfig(
  sources: unknown[],
  file: string,
  assembly: Assembly,
  name?: string,
): Track {
  const allStrings = sources.every(s => typeof s === 'string')
  const subadapters = allStrings
    ? sources.map(s => ({
        type: 'BigWigAdapter',
        bigWigLocation: makeLocation(s),
      }))
    : sources
  return {
    type: 'MultiQuantitativeTrack',
    trackId: path.basename(file),
    name: name ?? path.basename(file),
    assemblyNames: [assembly.name],
    adapter: {
      type: 'MultiWiggleAdapter',
      subadapters,
    },
  }
}
