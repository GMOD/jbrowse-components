import path from 'node:path'

import { makeLocation, syntenyFlags, trackFlags } from '@jbrowse/launch-args'

import type { Assembly, Track } from './types.ts'

export const trackTypes: string[] = [...trackFlags, 'multiwig']

export const syntenyTrackTypes: string[] = syntenyFlags

// Strings become subadapters rather than the adapter's `bigWigs` shorthand,
// which can only express URIs, so a local path works.
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
