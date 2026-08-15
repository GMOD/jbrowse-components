import { getMate } from '../syntenyMate.ts'
import { canLaunchSyntenyForMate } from './canLaunchSyntenyForMate.ts'

import type { RegionOfInterest } from './buildSyntenyViewSpec.ts'
import type { Feature } from '@jbrowse/core/util'

export interface MateCandidate {
  assemblyName: string
  // Every alignment the panel will open on, in the order the adapter served
  // them. Plural because a selection routinely covers several blocks of one
  // mate — see the note on `pickMatesForRegion` — and the panel spans all of
  // them.
  features: Feature[]
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
// open: one per mate assembly, carrying every alignment that assembly aligns the
// region with. An all-vs-all track draws every sample against the anchor at the
// same locus, so a region can carry dozens of alignments across a handful of
// assemblies.
//
// SEVERAL PER ASSEMBLY IS THE NORMAL CASE, not a curiosity. An HSP table (BLAST
// tabular) and a gene-anchor table (MCScan) are one row per hit, so any locus
// worth selecting is already dozens of blocks, and a minimap2 PAF splits at
// every structural difference. Keeping only the widest of them framed the panel
// — and, through the anchor row's union, the whole launched view — on one block,
// silently dropping the rest of the selection.
//
// ONE CONTIG PER PANEL, though: a panel opens on one stable sequence, so where
// an assembly's blocks land on two of its contigs (a rearrangement, a fragmented
// assembly) the one covering most of the region wins and the other is dropped,
// rather than unioning into a span covering neither. `resolvePanel` states the
// same rule over resolved spans for the callers that don't come through here.
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
  // keyed by assembly then by the mate's contig, so the majority contig can be
  // picked without a second pass over the features
  const byAssembly = new Map<
    string,
    Map<string, { features: Feature[]; overlap: number }>
  >()
  const unconfigured = new Set<string>()
  for (const feature of features) {
    const mate = getMate(feature)
    const assemblyName = mate?.assemblyName
    if (
      mate &&
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
        const byRefName = byAssembly.get(assemblyName) ?? new Map()
        byAssembly.set(assemblyName, byRefName)
        const entry = byRefName.get(mate.refName) ?? {
          features: [],
          overlap: 0,
        }
        entry.features.push(feature)
        entry.overlap += Math.max(0, overlapBp(feature, region))
        byRefName.set(mate.refName, entry)
      }
    }
  }
  return {
    mates: [...new Set(trackAssemblyNames)].flatMap(assemblyName => {
      const byRefName = byAssembly.get(assemblyName)
      const best = byRefName
        ? [...byRefName.values()].reduce((a, b) =>
            b.overlap > a.overlap ? b : a,
          )
        : undefined
      return best ? [{ assemblyName, features: best.features }] : []
    }),
    // sorted so the same locus always words its message the same way; the mates
    // keep the config's own order instead, which is a choice the author made
    unconfigured: [...unconfigured].sort(),
  }
}
