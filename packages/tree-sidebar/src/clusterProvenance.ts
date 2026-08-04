import { assembleLocString } from '@jbrowse/core/util'

// What a cluster tree was computed FROM, stored beside the tree itself.
//
// Clustering reads only the region currently in view, but the tree it produces
// is a persisted field with no memory of that: `treeDescribesRows` gates the
// dendrogram on the row *names* alone, so panning to another locus — even
// another chromosome — leaves the same tree drawn, unchanged, beside completely
// different data. Nothing on screen said which locus a dendrogram summarized,
// and `clusterTree` travels through a session snapshot (see the URL-params
// docs), so a shared link handed the recipient a tree with no way to find out.
//
// A dendrogram read as "how these samples relate" while actually meaning "how
// they related over a window you have since left" is the failure mode this
// exists to prevent, and it is the one a reader is most likely to carry into a
// figure caption.
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
  // Regions the matrix was built over, structured rather than pre-formatted so
  // drift can be measured numerically rather than by string equality — see
  // `clusterProvenanceOverlap`.
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

// Short label for the locus, for a chip with very little room.
//
// `assemblyName` is dropped from the label but kept in the data: the caption
// sits inside one track in one view, so `{volvox}ctgA:1..50,000` spends its
// scarce width restating the context it is already displayed in. The stored
// value still distinguishes same-named refs across assemblies for the overlap
// test below.
export function clusterProvenanceLocLabel(provenance: ClusterProvenance) {
  const [first, ...rest] = provenance.regions
  if (!first) {
    return 'an unknown region'
  }
  const loc = assembleLocString({ ...first, assemblyName: undefined })
  return rest.length ? `${loc} +${rest.length} more` : loc
}

// The full sentence, for a tooltip and for the SVG export's caption — the one
// that ends up under a figure.
export function describeClusterProvenance(provenance: ClusterProvenance) {
  const parts = [`Clustered on ${clusterProvenanceLocLabel(provenance)}`]
  for (const { name, value } of provenance.settings ?? []) {
    parts.push(`${name}: ${value}`)
  }
  return parts.join(' · ')
}

function overlapLength(a: ClusterProvenanceRegion, b: ClusterProvenanceRegion) {
  // Assemblies are compared only when both sides name one: a session saved
  // before the field existed, or a caller passing bare regions, should still
  // match on refName rather than reporting drift everywhere. Two assemblies
  // both having a `chr1` is the case this guards.
  const sameRef =
    a.refName === b.refName &&
    (!a.assemblyName || !b.assemblyName || a.assemblyName === b.assemblyName)
  return sameRef
    ? Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
    : 0
}

// Fraction of the clustered span still on screen, in [0, 1].
//
// Deliberately a fraction rather than an equality test: `contentBlocks` shift
// by a fraction of a bp on any pan or zoom, so comparing them for equality
// would report a stale tree constantly and train the reader to ignore the
// warning. What matters is whether the tree still describes what is being
// looked at, which is a question about overlap.
export function clusterProvenanceOverlap(
  provenance: ClusterProvenance,
  current: readonly ClusterProvenanceRegion[],
) {
  let total = 0
  let covered = 0
  for (const region of provenance.regions) {
    const span = Math.max(0, region.end - region.start)
    total += span
    // Blocks within one view don't overlap each other, so summing per-block
    // overlaps can't double-count. Clamp anyway: a caller passing overlapping
    // regions should get a bounded answer rather than a fraction above 1.
    let hit = 0
    for (const c of current) {
      hit += overlapLength(region, c)
    }
    covered += Math.min(span, hit)
  }
  return total === 0 ? 0 : covered / total
}

// Below this much of the clustered region left in view, the tree is described
// as no longer matching. Set well away from 1 so ordinary panning and zooming
// inside the clustered locus stays quiet, and comfortably above 0 so that
// panning most of the way off it — or onto another chromosome, which scores 0 —
// still speaks up.
export const CLUSTER_PROVENANCE_MIN_OVERLAP = 0.5

export function clusterProvenanceDrifted(
  provenance: ClusterProvenance,
  current: readonly ClusterProvenanceRegion[],
) {
  return (
    clusterProvenanceOverlap(provenance, current) <
    CLUSTER_PROVENANCE_MIN_OVERLAP
  )
}
