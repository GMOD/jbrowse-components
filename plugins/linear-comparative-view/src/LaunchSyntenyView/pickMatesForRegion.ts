import { getMate } from '../syntenyMate.ts'
import { canLaunchSyntenyForMate } from './canLaunchSyntenyForMate.ts'

import type { RegionOfInterest } from './buildSyntenyViewSpec.ts'
import type { Feature } from '@jbrowse/core/util'

export interface MateCandidate {
  assemblyName: string
  feature: Feature
}

export interface MateDiscoveryResult {
  mates: MateCandidate[]
  // Mate labels present at the locus that the track declares no assembly for,
  // so no panel can open on them. Reported rather than dropped silently: an
  // all-vs-all file routinely holds far more PanSN samples than a config
  // declares, so a display can draw a dozen lanes at a locus where the launch
  // offers two panels — or none, which read as "nothing aligns here" and is the
  // opposite of what the user is looking at.
  unconfigured: string[]
}

function overlapBp(feature: Feature, region: RegionOfInterest) {
  return (
    Math.min(feature.get('end'), region.end) -
    Math.max(feature.get('start'), region.start)
  )
}

// Reduce a region's alignments to the panels a multi-way synteny view would
// open: one per mate assembly, keeping whichever alignment covers the most of
// the region. An all-vs-all track draws every sample against the anchor at the
// same locus, so a region can carry dozens of alignments across a handful of
// assemblies — and several per assembly once a segmental duplication or a
// fragmented assembly puts more than one block over the same bases. The widest
// one is the one worth anchoring a panel on.
//
// Panels come back in the track's declared `assemblyNames` order rather than by
// overlap, so the same region always produces the same panel order (and the
// order a config author chose), deduplicated so a name declared twice cannot
// produce two identical panels. The anchor's own assembly is dropped: an
// all-vs-all track's self lane holds only internal repeats, not a comparison —
// unless the track is a self-alignment (every declared name is the anchor's, a
// genome against its own paralogy), where that lane is the whole comparison and
// dropping it left the dialog reporting that nothing aligned.
export function pickMatesForRegion({
  features,
  region,
  trackAssemblyNames,
  anchorAssembly,
}: {
  features: Feature[]
  region: RegionOfInterest
  trackAssemblyNames: string[]
  anchorAssembly: string
}): MateDiscoveryResult {
  const selfAlignment = trackAssemblyNames.every(
    name => name === anchorAssembly,
  )
  const best = new Map<string, { feature: Feature; overlap: number }>()
  const unconfigured = new Set<string>()
  for (const feature of features) {
    const assemblyName = getMate(feature)?.assemblyName
    if (
      assemblyName !== undefined &&
      (selfAlignment || assemblyName !== anchorAssembly)
    ) {
      // Split here rather than leaving it to the declared-order walk below,
      // which would drop an undeclared mate anyway: they are worth counting, and
      // an all-vs-all file can carry far more samples than the config declares,
      // so this also keeps them out of the map instead of building and
      // discarding an entry per sample.
      if (!canLaunchSyntenyForMate(trackAssemblyNames, assemblyName)) {
        unconfigured.add(assemblyName)
      } else {
        const overlap = overlapBp(feature, region)
        const prev = best.get(assemblyName)
        if (!prev || overlap > prev.overlap) {
          best.set(assemblyName, { feature, overlap })
        }
      }
    }
  }
  return {
    mates: [...new Set(trackAssemblyNames)]
      .filter(assemblyName => best.has(assemblyName))
      .map(assemblyName => ({
        assemblyName,
        feature: best.get(assemblyName)!.feature,
      })),
    // sorted so the same locus always words its message the same way; the mates
    // keep the config's own order instead, which is a choice the author made
    unconfigured: [...unconfigured].sort(),
  }
}
