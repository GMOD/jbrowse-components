import { assembleLocString } from '@jbrowse/core/util'

// What a cluster tree was computed FROM, stored beside the tree itself.
// Clustering reads only the region in view, and the tree persists through pans
// and session snapshots, so the Clustering submenu names that region
// (`clusterProvenanceMenuItems`).
//
// Only *computed* trees carry provenance. A tree supplied as data — maf's
// `.nh` guide tree — has none, which is also how a consumer can tell a
// phylogeny from a similarity dendrogram.
export interface ClusterProvenanceRegion {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

export interface ClusterProvenance {
  // Regions the matrix was built over.
  regions: ClusterProvenanceRegion[]
  // Everything else that fed the matrix and would change the result: filters,
  // sampling density, the color scheme a painting was clustered on. Displayed
  // verbatim, so these are user-facing labels, not field names.
  settings?: { name: string; value: string }[]
}

// Build one from the blocks a run was given. `contentBlocks` carry plenty of
// other fields (keys, offsets, widths); keeping only the four that describe the
// locus keeps the snapshot small and stable across zoom levels.
export function clusterProvenanceFromRegions(
  regions: readonly ClusterProvenanceRegion[],
  settings?: { name: string; value: string }[],
): ClusterProvenance {
  return {
    regions: regions.map(r => ({
      refName: r.refName,
      start: r.start,
      end: r.end,
      ...(r.assemblyName ? { assemblyName: r.assemblyName } : {}),
    })),
    ...(settings?.length ? { settings } : {}),
  }
}

// Short label for the locus.
//
// `assemblyName` is dropped from the label but kept in the data: the caption
// sits inside one track in one view, so `{volvox}ctgA:1..50,000` restates the
// context it is already displayed in.
export function clusterProvenanceLocLabel(provenance: ClusterProvenance) {
  const [first, ...rest] = provenance.regions
  if (!first) {
    return 'an unknown region'
  }
  const loc = assembleLocString({ ...first, assemblyName: undefined })
  return rest.length ? `${loc} +${rest.length} more` : loc
}

// The full sentence, for the Clustering submenu.
export function describeClusterProvenance(provenance: ClusterProvenance) {
  const parts = [`Clustered on ${clusterProvenanceLocLabel(provenance)}`]
  for (const { name, value } of provenance.settings ?? []) {
    parts.push(`${name}: ${value}`)
  }
  return parts.join(' · ')
}
