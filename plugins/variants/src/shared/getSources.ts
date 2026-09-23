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

const HAPLOTYPE_ROW_NAME = /^(.*) HP(\d+)$/

function haplotypeRow(
  source: Source,
  sampleName: string,
  HP: number,
): HaplotypeSource {
  return { ...source, name: `${sampleName} HP${HP}`, sampleName, HP }
}

function makeHaplotypeSources(
  source: Source,
  ploidy: number,
): HaplotypeSource[] {
  const sampleName = resolveSampleName(source)
  return Array.from({ length: ploidy }, (_, i) =>
    haplotypeRow(source, sampleName, i),
  )
}

/**
 * The inverse of the haplotype naming: the sample a row name belongs to, and
 * the haplotype where it names one. A current sample's own name wins, so a
 * sample called "X HP0" never reads as a haplotype of "X". Undefined for a
 * name no current sample answers to.
 */
export function parseRowName(
  name: string,
  samples: ReadonlySet<string>,
): { sampleName: string; HP?: number } | undefined {
  if (samples.has(name)) {
    return { sampleName: name }
  }
  const match = HAPLOTYPE_ROW_NAME.exec(name)
  return match && samples.has(match[1]!)
    ? { sampleName: match[1]!, HP: Number(match[2]) }
    : undefined
}

// The "<sampleName> HP<n>" haplotype-row convention, with `parseRowName` its
// inverse, for the worker's cell computation and genotype matrix and the
// display's rows alike. A source that already carries an HP index (a row of a
// phased clustering run) passes through; the rest expand into maxPloidy rows,
// keyed by sampleName, defaulting to diploid.
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
 * rows it draws (`rowRemap` → `placeVariantRows`). A reorder, a regroup or a
 * clustering run therefore re-uploads the cells already in hand without
 * re-downloading the VCF; see reference/FETCH_KEYS.md §"Row order is not a fetch input".
 *
 * `buildCanonicalRows` sits beside `expandSourcesToHaplotypes` and shares that
 * expansion, so it produces the same `"<sampleName> HP<n>"` strings the client
 * does. Every phased row places by that name, and a mismatch would place every
 * phased row at `HIDDEN_ROW`.
 *
 * The rows come from `sampleInfo`: every sample the fetched genotypes mention,
 * narrowed by `sampleFilter` when the client draws a subset. Its order is
 * first-seen and therefore arbitrary, which is fine because nothing is drawn in
 * that order. A sample the client lists but this window's genotypes never
 * mention gets no row and no cells, and it would have drawn no cells anyway.
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

// The haplotypes a sample takes a row for: the ploidy `sampleInfo` reports,
// plus any the order names beyond it. Until `sampleInfo` lands the names
// alone stand for it, so an arranged track keeps its haplotype rows across a
// refetch rather than folding back to samples.
function haplotypesOf(
  sampleName: string,
  sampleInfo: Record<string, SampleInfo> | undefined,
  named: ReadonlyMap<string, readonly number[]>,
) {
  const ploidy = sampleInfo ? (sampleInfo[sampleName]?.maxPloidy ?? 2) : 0
  const hps = new Set(named.get(sampleName))
  for (let i = 0; i < ploidy; i++) {
    hps.add(i)
  }
  return [...hps].sort((a, b) => a - b)
}

function haplotypesNamed(domain: readonly string[], samples: Set<string>) {
  const named = new Map<string, number[]>()
  for (const name of domain) {
    const row = parseRowName(name, samples)
    if (row?.HP !== undefined) {
      const hps = named.get(row.sampleName) ?? []
      hps.push(row.HP)
      named.set(row.sampleName, hps)
    }
  }
  return named
}

/**
 * The sample rows as phased mode draws them: one row per haplotype
 * (`haplotypesOf`), each carrying its sample's fields. A sample with no
 * haplotype known yet stays one row, standing for them. Hands back `rows`
 * itself when no sample expands.
 */
export function expandPhasedRows({
  rows,
  sampleInfo,
  domain,
}: {
  rows: ProcessedSource[]
  sampleInfo: Record<string, SampleInfo> | undefined
  domain: readonly string[]
}): ProcessedSource[] {
  const named = haplotypesNamed(
    domain,
    new Set(rows.map(row => row.sampleName)),
  )
  let expanded = false
  const out: ProcessedSource[] = []
  for (const row of rows) {
    const hps = haplotypesOf(row.sampleName, sampleInfo, named)
    if (hps.length) {
      expanded = true
      for (const HP of hps) {
        out.push(haplotypeRow(row, row.sampleName, HP))
      }
    } else {
      out.push(row)
    }
  }
  return expanded ? out : rows
}
