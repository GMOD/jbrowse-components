import type { ProcessedSource, SampleInfo, Source } from './types.ts'

// A source's bare VCF sample identity: `sampleName` when present (set once a
// source is processed/HP-expanded), else the raw `name`. Single source of truth
// for the fallback so every genotype-map lookup keys by the same string — see
// the "genotype maps cross the RPC boundary keyed by sampleName" note in
// plugins/variants/src/CLAUDE.md.
export function resolveSampleName(source: Source) {
  return source.sampleName ?? source.name
}

// Every row a haplotype expansion produces names exactly one haplotype, so `HP`
// is resolved rather than optional. Consumers that index *by* haplotype (the
// phased genotype-matrix rows) get that from the type instead of restating a
// ploidy fallback of their own.
export type HaplotypeSource = ProcessedSource & { HP: number }

function makeHaplotypeSources(
  source: Source,
  ploidy: number,
): HaplotypeSource[] {
  const results: HaplotypeSource[] = []
  const sampleName = resolveSampleName(source)
  for (let i = 0; i < ploidy; i++) {
    results.push({
      ...source,
      name: `${sampleName} HP${i}`,
      sampleName,
      HP: i,
    })
  }
  return results
}

// Single source of truth for the "<sampleName> HP<n>" haplotype-row convention.
// Shared by the worker (cell computation), the model `sources` getter (sidebar
// rows / row count), and the cluster dialog — keeping the naming + ploidy rules
// in one place so the three sites can't drift. Sources that already carry an HP
// index (e.g. from haplotype clustering) pass through unchanged; the rest expand
// into maxPloidy rows, keyed by sampleName, defaulting to diploid.
export function expandSourcesToHaplotypes({
  sources,
  sampleInfo,
}: {
  sources: Source[]
  sampleInfo: Record<string, SampleInfo>
}): HaplotypeSource[] {
  return sources.flatMap(source => {
    const sampleName = resolveSampleName(source)
    const { HP } = source
    if (HP !== undefined) {
      return [{ ...source, sampleName, HP }]
    }
    return makeHaplotypeSources(source, sampleInfo[sampleName]?.maxPloidy ?? 2)
  })
}

/**
 * The worker's own row list: one entry per sample it will emit cells for, HP-
 * expanded in phased mode. Built in the worker rather than taken from the
 * client, so no row *order* crosses the RPC boundary — `cellRowIndices` index
 * into this list, `rowNames` names it, and the client maps those names onto the
 * rows it draws (`rowRemap` → `placeVariantRows`). That is what lets a reorder,
 * a regroup or a clustering run re-upload the cells already in hand instead of
 * re-downloading the VCF; see ARCHITECTURE.md §"Row order is not a fetch input".
 *
 * Lives here, beside `expandSourcesToHaplotypes`, because the one thing it must
 * get right is producing the same `"<sampleName> HP<n>"` strings the client's
 * own expansion does — every phased row places by that name, and a drift would
 * silently strand all of them. Sharing the expansion is how that stays true.
 *
 * The universe is `sampleInfo`: every sample the fetched genotypes mention,
 * narrowed by `sampleFilter` when the client draws a subset. Its order is
 * first-seen and therefore arbitrary, which is fine precisely because it is
 * never the order anything is drawn in. A sample the client lists but this
 * window's genotypes never mention gets no row, and so no cells — which is what
 * it would have drawn anyway.
 */
export function buildCanonicalRows({
  sampleInfo,
  sampleFilter,
  renderingMode,
}: {
  sampleInfo: Record<string, SampleInfo>
  // `undefined` is "every sample", an empty list is "no samples" — they are not
  // the same answer and collapsing them costs a whole cell matrix. Only the
  // client's pre-sources state sends `undefined`; a filter that resolved to
  // nothing sends `[]` and must compute nothing, which is also what the display
  // will draw.
  sampleFilter: string[] | undefined
  renderingMode: string
}): ProcessedSource[] {
  const keep = sampleFilter ? new Set(sampleFilter) : undefined
  const rows: ProcessedSource[] = []
  for (const sampleName in sampleInfo) {
    if (!keep || keep.has(sampleName)) {
      rows.push({ name: sampleName, sampleName })
    }
  }
  return renderingMode === 'phased'
    ? expandSourcesToHaplotypes({ sources: rows, sampleInfo })
    : rows
}

/**
 * `layout` is an ordering/override hint, never the row set — the same membership
 * rule tree-sidebar's `reconcileLayout` gives maf, multi-row features and
 * multi-wiggle: a sample it omits belongs at the end, not dropped. Narrowing the
 * rows is `subtreeFilter`'s job in all four, and it is the one that reaches the
 * fetch (`sampleFilter`).
 *
 * "Covered" is keyed by **sampleName**, not `name`: after a phased clustering run
 * the layout rows are haplotypes ("HG001 HP0"), which match no sample name, so a
 * `name` key would read the layout as covering nothing and re-append every sample
 * on top of its own haplotypes.
 *
 * Returns `layout` itself when it already covers everything — the case every
 * layout the app can produce is in, since each of them (`arrangeSources`,
 * `buildClusteredLayout`, `sortSourcesAroundVariant`, the arrangement dialog)
 * covers all rows.
 */
function appendUncoveredSamples(sources: Source[], layout: Source[]): Source[] {
  const covered = new Set(layout.map(resolveSampleName))
  const uncovered = sources.filter(s => !covered.has(s.name))
  return uncovered.length ? [...layout, ...uncovered] : layout
}

export function getSources({
  sources,
  layout = sources,
  renderingMode,
  sampleInfo,
}: {
  sources: Source[]
  layout?: Source[]
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
}): ProcessedSource[] {
  // A Map, not an object keyed by sample name: names come from the file, and on
  // a plain object a sample called `constructor` or `toString` reads back an
  // inherited value instead of `undefined`, so the miss check below would keep a
  // row that has no source. It also builds and probes faster at cohort sizes,
  // and this runs on every reorder (`sourcesBase` is a computed).
  const sourceMap = new Map(sources.map(s => [s.name, s]))

  return appendUncoveredSamples(sources, layout).flatMap(row => {
    const sampleName = resolveSampleName(row)
    const baseSource = sourceMap.get(sampleName)

    if (!baseSource) {
      return []
    }

    const merged = { ...baseSource, ...row }
    // The row tint is `labelColor`, the channel tree-sidebar draws. A
    // `samplesTsv` `color` column, and a session saved when the palette was
    // written there, both reach the sidebar through this one fallback.
    if (merged.labelColor === undefined && merged.color !== undefined) {
      merged.labelColor = merged.color
    }

    // Phased expansion needs sampleInfo to know ploidy. Without it we fall
    // through and return the sample row as-is — matches the `sources` getter
    // in MultiSampleVariantBaseModel, which waits for sampleInfo before
    // expanding. Once sampleInfo is present, missing samples default to
    // diploid to match `expandSourcesToHaplotypes`.
    if (
      renderingMode === 'phased' &&
      row.HP === undefined &&
      sampleInfo !== undefined
    ) {
      return makeHaplotypeSources(
        merged,
        sampleInfo[sampleName]?.maxPloidy ?? 2,
      )
    }
    return [{ ...merged, sampleName }]
  })
}
