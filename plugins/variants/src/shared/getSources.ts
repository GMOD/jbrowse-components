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

/** What a reader arranged, by row name: the order, the labels, the tints. */
export interface RowArrangement {
  domain: readonly string[]
  labels: Readonly<Record<string, string>>
  rowColors: ReadonlyMap<string, string>
}

// The haplotypes a sample takes a row for: the ploidy `sampleInfo` reports,
// plus any the arrangement names beyond it. Until `sampleInfo` lands the names
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

// A row answers to its own name and then to its sample's, so an order, a label
// or a tint written against a sample reaches each of its haplotypes. The rows
// the domain lists lead, in its order; the rest keep the order they came in.
function orderByDomain(rows: ProcessedSource[], domain: readonly string[]) {
  if (!domain.length) {
    return rows
  }
  const rank = new Map<string, number>()
  domain.forEach((name, i) => {
    if (!rank.has(name)) {
      rank.set(name, i)
    }
  })
  const ranked = rows.map(row => ({
    row,
    rank: rank.get(row.name) ?? rank.get(row.sampleName),
  }))
  const listed = ranked.filter(r => r.rank !== undefined)
  return listed.length
    ? [
        ...listed.sort((a, b) => a.rank! - b.rank!).map(r => r.row),
        ...ranked.filter(r => r.rank === undefined).map(r => r.row),
      ]
    : rows
}

// Own-property reads: row names come from the file, and a sample called
// `constructor` would otherwise read a label off Object.prototype.
function labelOf(labels: Readonly<Record<string, string>>, row: Source) {
  const { name, sampleName } = row
  return Object.hasOwn(labels, name)
    ? labels[name]
    : sampleName !== undefined && Object.hasOwn(labels, sampleName)
      ? labels[sampleName]
      : undefined
}

/**
 * The adapter's samples as the rows of the rendering mode — one per sample in
 * allele-count mode, one per haplotype in phased mode (`haplotypesOf`) — in
 * the reader's arrangement: the order `domain` gives, a label from `labels`
 * over the adapter's, and the tint `labelColor` from `rowColors`, then the
 * adapter's `labelColor`, then a samplesTsv `color` column. A sample the order
 * omits is appended, not dropped.
 *
 * No focus, and no `rowColor` palette: this is the list the arrangement
 * dialog edits, and it writes back only what it differs from the adapter in.
 */
export function arrangeRows({
  sources,
  renderingMode,
  sampleInfo,
  arrangement: { domain, labels, rowColors },
}: {
  sources: Source[]
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
  arrangement: RowArrangement
}): ProcessedSource[] {
  const phased = renderingMode === 'phased'
  const samples = new Set(sources.map(resolveSampleName))
  const named = phased ? haplotypesNamed(domain, samples) : new Map()
  const rows = sources.flatMap((source): ProcessedSource[] => {
    const sampleName = resolveSampleName(source)
    const hps = phased ? haplotypesOf(sampleName, sampleInfo, named) : []
    return hps.length
      ? hps.map(HP => haplotypeRow(source, sampleName, HP))
      : [{ ...source, sampleName }]
  })
  return orderByDomain(rows, domain).map(row => {
    const label = labelOf(labels, row)
    const labelColor =
      rowColors.get(row.name) ??
      rowColors.get(row.sampleName) ??
      row.labelColor ??
      row.color
    return {
      ...row,
      ...(label === undefined ? {} : { label }),
      ...(labelColor === undefined ? {} : { labelColor }),
    }
  })
}

/**
 * The rows a focus keeps. A name in `kept` keeps that row, and a sample's name
 * keeps all of its haplotypes; a sample row not yet expanded stands for its
 * haplotypes, so it is kept when any of them is. That makes the same `kept`
 * narrow the adapter's samples to the set the fetch asks for and the arranged
 * rows to the ones drawn. A focus naming no current row keeps every row.
 */
export function keptRowsOf<S extends Source>(
  rows: S[],
  kept: readonly string[] | undefined,
): S[] {
  if (!kept?.length) {
    return rows
  }
  const current = new Set(rows.map(resolveSampleName))
  const samples = new Set(
    kept.flatMap(name => {
      const row = parseRowName(name, current)
      return row ? [row.sampleName] : []
    }),
  )
  const ofSamples = rows.filter(row => samples.has(resolveSampleName(row)))
  if (!ofSamples.length) {
    return rows
  }
  const names = new Set(kept)
  const exact = ofSamples.filter(
    row =>
      row.HP === undefined ||
      names.has(row.name) ||
      names.has(resolveSampleName(row)),
  )
  return exact.length ? exact : ofSamples
}
