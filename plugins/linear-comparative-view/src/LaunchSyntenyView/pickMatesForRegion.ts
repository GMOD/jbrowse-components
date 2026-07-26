import { getMate } from '../syntenyMate.ts'
import { canLaunchSyntenyForMate } from './buildSyntenyViewSpec.ts'

import type { RegionOfInterest } from './buildSyntenyViewSpec.ts'
import type { Feature } from '@jbrowse/core/util'

export interface MateCandidate {
  assemblyName: string
  feature: Feature
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
}): MateCandidate[] {
  const selfAlignment = trackAssemblyNames.every(
    name => name === anchorAssembly,
  )
  const best = new Map<string, { feature: Feature; overlap: number }>()
  for (const feature of features) {
    const assemblyName = getMate(feature)?.assemblyName
    if (
      assemblyName !== undefined &&
      (selfAlignment || assemblyName !== anchorAssembly) &&
      canLaunchSyntenyForMate(trackAssemblyNames, assemblyName)
    ) {
      const overlap = overlapBp(feature, region)
      const prev = best.get(assemblyName)
      if (!prev || overlap > prev.overlap) {
        best.set(assemblyName, { feature, overlap })
      }
    }
  }
  return [...new Set(trackAssemblyNames)]
    .filter(assemblyName => best.has(assemblyName))
    .map(assemblyName => ({
      assemblyName,
      feature: best.get(assemblyName)!.feature,
    }))
}
