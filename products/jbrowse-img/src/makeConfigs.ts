import path from 'node:path'

import { makeLocation, trackFlags } from '@jbrowse/launch-args'

import type { Assembly, Track } from './types.ts'

export { makeLocation }

export const trackTypes: string[] = [...trackFlags, 'multiwig']

// Comparison/synteny adapters. Each maps a CLI file type to its adapter type,
// the fileLocation slot that adapter reads from, and which of the two stacked
// assemblies the file's QUERY coordinates belong to.
//
// The distinction matters and is easy to get backwards: PAF/BLAST list the query
// first (minimap2/blast align a query against a target), so the upper assembly —
// written first — is the query. A chain/delta file instead describes a
// target→query liftover (a UCSC `targetToQuery.over.chain` maps FROM the target
// reference TO the query), so there the upper assembly is the TARGET. Picking the
// wrong one silently mis-maps coordinates and most alignments drop out.
const syntenyAdapterMap: Record<
  string,
  { adapterType: string; locSlot: string; upperAssemblyIsQuery: boolean }
> = {
  paf: {
    adapterType: 'PAFAdapter',
    locSlot: 'pafLocation',
    upperAssemblyIsQuery: true,
  },
  blasttab: {
    adapterType: 'BlastTabularAdapter',
    locSlot: 'blastTableLocation',
    upperAssemblyIsQuery: true,
  },
  chain: {
    adapterType: 'ChainAdapter',
    locSlot: 'chainLocation',
    upperAssemblyIsQuery: false,
  },
  delta: {
    adapterType: 'DeltaAdapter',
    locSlot: 'deltaLocation',
    upperAssemblyIsQuery: false,
  },
}

export const syntenyTrackTypes = Object.keys(syntenyAdapterMap)

// Build a SyntenyTrack for one level of a comparative view, given the two
// assemblies it sits between in stacked (top-to-bottom) order. The file format
// decides which is the query and which the target (see syntenyAdapterMap); the
// adapter's explicit queryAssembly/targetAssembly slots make that wiring legible
// rather than hiding it in a positional [query, target] array.
export function makeSyntenyTrackConfig(
  type: string,
  file: string,
  upperAssembly: string,
  lowerAssembly: string,
): Track {
  const { adapterType, locSlot, upperAssemblyIsQuery } =
    syntenyAdapterMap[type]!
  const queryAssembly = upperAssemblyIsQuery ? upperAssembly : lowerAssembly
  const targetAssembly = upperAssemblyIsQuery ? lowerAssembly : upperAssembly
  return {
    type: 'SyntenyTrack',
    trackId: path.basename(file),
    name: path.basename(file),
    // assemblyNames is [query, target] (see comparative-adapters/util.ts).
    assemblyNames: [queryAssembly, targetAssembly],
    adapter: {
      type: adapterType,
      [locSlot]: makeLocation(file),
      queryAssembly,
      targetAssembly,
    },
  }
}

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
