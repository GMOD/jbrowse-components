import { frame, rStr } from './rplot.ts'

import type { RFrame } from './rplot.ts'

/**
 * Adapter type to the reader that answers it, the config slot holding its file,
 * and the columns the reader's frame then has.
 *
 * A table rather than a switch, because what a new format needs is a row: an
 * adapter absent from it is reported, never guessed at, and adding one cannot
 * disturb the others.
 */
export const READERS = {
  BigWigAdapter: {
    helper: 'read_bigwig',
    location: 'bigWigLocation',
    packages: ['rtracklayer', 'GenomicRanges'],
    columns: ['seqnames', 'start', 'end', 'width', 'strand', 'score'],
    coords: ['start', 'end'],
    args: '',
  },
  Gff3TabixAdapter: {
    helper: 'read_gff',
    location: 'gffGzLocation',
    packages: ['rtracklayer', 'GenomicRanges'],
    columns: ['start', 'end', 'strand', 'type', 'id', 'parent', 'name'],
    coords: ['start', 'end'],
    args: '',
  },
  VcfTabixAdapter: {
    helper: 'read_vcf',
    location: 'vcfGzLocation',
    packages: ['Rsamtools', 'GenomicRanges'],
    columns: ['start', 'end', 'ref', 'alt', 'type'],
    coords: ['start', 'end'],
    args: '',
  },
} as const

export type ReaderName = keyof typeof READERS
export type ReaderColumn<K extends ReaderName> =
  (typeof READERS)[K]['columns'][number]

export function isReadable(type: string): type is ReaderName {
  return type in READERS
}

/**
 * The path or URL a JBrowse file location points at, as a string R opens.
 *
 * Both arms of the union matter: a hosted track is `{ uri }` and a local one
 * `{ localPath }`, and R opens either the same way. A config names its files
 * relative to itself, so a bare `uri` without its `baseUri` resolves to a file
 * in whatever directory the reader happened to run `Rscript` from.
 */
export function locationPath(location: unknown) {
  const loc = location as
    | { uri?: string; baseUri?: string; localPath?: string }
    | undefined
  if (!loc?.uri) {
    return loc?.localPath
  }
  const { uri, baseUri } = loc
  const resolved = baseUri ? new URL(uri, baseUri).href : uri
  return resolved.startsWith('file://')
    ? decodeURIComponent(new URL(resolved).pathname)
    : resolved
}

/**
 * The file behind an adapter config.
 *
 * Both the slot and the bare shorthand, because a config can hold either:
 * several adapters take a `uri` that `preProcessSnapshot` rewrites into the
 * location slot, so a config read before that ran has one spelling and one read
 * after has the other. Reading only the slot left BigBed tracks emitting
 * `path <- ""`, which R rejects only after opening everything else.
 */
export function uriOf(adapter: Record<string, unknown>, slot: string) {
  return (
    locationPath(adapter[slot]) ??
    locationPath(adapter.uri) ??
    (typeof adapter.uri === 'string' ? adapter.uri : undefined)
  )
}

/**
 * The frame a track's adapter reads, over every region on one cumulative axis.
 *
 * `read_regions` is the only place genomic coordinates become cumulative ones,
 * so a reader stays genomic and a new format needs no axis code.
 */
export function frameFor<K extends ReaderName>({
  type,
  uri,
  name = 'df',
}: {
  type: K
  uri: string
  name?: string
}): RFrame<ReaderColumn<K> | '.region'> {
  const reader = READERS[type]
  const coords = reader.coords.map(c => rStr(c)).join(', ')
  return frame({
    name,
    columns: [...reader.columns, '.region'] as const,
    packages: reader.packages,
    statements: `${name} <- read_regions(
  function(chrom, start, end) ${reader.helper}(${rStr(uri)}, chrom, start, end),
  regions, c(${coords}))`,
  })
}

/** The helpers a frame's statements reference, for the script's closure. */
export function helpersFor(type: ReaderName) {
  return [READERS[type].helper, 'read_regions', 'region_layout']
}
