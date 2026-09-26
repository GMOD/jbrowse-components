import { resolveUri } from '@jbrowse/core/util/getLocationUri'

import { frame, rStr } from './rplot.ts'

import type { RFrame } from './rplot.ts'

/**
 * Adapter type to the reader that answers it, the config slot holding its file,
 * the columns the reader's frame always has, and how it is asked for the rest:
 * a GFF3 reader takes attribute names, a VCF reader INFO keys, a BigWig
 * reader nothing, since its every column is already there.
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
    extra: undefined,
  },
  Gff3TabixAdapter: {
    helper: 'read_gff',
    location: 'gffGzLocation',
    packages: ['rtracklayer', 'Rsamtools', 'GenomicRanges'],
    columns: [
      'start',
      'end',
      'strand',
      'type',
      'source',
      'score',
      'phase',
      'id',
      'parent',
      'name',
    ],
    coords: ['start', 'end'],
    extra: { arg: 'attrs', prefix: '' },
  },
  VcfTabixAdapter: {
    helper: 'read_vcf',
    location: 'vcfGzLocation',
    packages: ['Rsamtools', 'GenomicRanges'],
    columns: ['start', 'end', 'name', 'REF', 'ALT', 'QUAL', 'FILTER', 'type'],
    coords: ['start', 'end'],
    extra: { arg: 'info', prefix: 'INFO.' },
  },
} as const

export type ReaderName = keyof typeof READERS

export function isReadable(type: string): type is ReaderName {
  return type in READERS
}

/**
 * The path or URL a JBrowse file location points at, as a string R opens.
 *
 * Both arms of the union matter: a hosted track is `{ uri }` and a local one
 * `{ localPath }`, and R opens either the same way. A `uri` resolves against
 * its `baseUri` as the fetch did, since a bare relative one names a file in
 * whatever directory `Rscript` happened to run from.
 */
export function locationPath(location: unknown) {
  const loc = location as
    | { uri?: string; baseUri?: string; localPath?: string }
    | undefined
  if (!loc?.uri) {
    return loc?.localPath
  }
  const resolved = resolveUri({ uri: loc.uri, baseUri: loc.baseUri })
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
 * What the script's header says about where it reads from. A presigned S3 or
 * GCS link carries its credential in the query, and R needs it verbatim to
 * open the file, so the script is not one to hand around.
 */
export function sourceNotes(uri: string) {
  return uri.includes('://') && uri.includes('?')
    ? [
        'source: the URL carries its query string, credential included, so the script is not one to share',
      ]
    : []
}

/**
 * The frame a track's adapter reads, over every region on one cumulative axis,
 * holding the reader's own columns and `fields` on top: the file's fields the
 * display names, which a GFF3 reader fetches as attributes and a VCF reader as
 * INFO keys. A BigWig has nothing beyond its columns, so its `fields` are the
 * columns the marks will then be refused.
 *
 * `read_regions` is the only place genomic coordinates become cumulative ones,
 * so a reader stays genomic and a new format needs no axis code.
 */
export function frameFor<K extends ReaderName>({
  type,
  uri,
  name = 'df',
  fields = [],
}: {
  type: K
  uri: string
  name?: string
  fields?: readonly string[]
}): RFrame {
  const reader = READERS[type]
  const held = new Set<string>(reader.columns)
  const { extra } = reader
  const asked = extra
    ? fields.filter(f => !held.has(f) && f.startsWith(extra.prefix))
    : []
  const args = asked.length
    ? `, ${extra!.arg} = c(${asked.map(f => rStr(f.slice(extra!.prefix.length))).join(', ')})`
    : ''
  const coords = reader.coords.map(c => rStr(c)).join(', ')
  return frame({
    name,
    columns: [...reader.columns, ...asked, '.region'],
    coords: reader.coords,
    packages: reader.packages,
    statements: `${name} <- read_regions(
  function(chrom, start, end) ${reader.helper}(${rStr(uri)}, chrom, start, end${args}),
  regions, c(${coords}))`,
  })
}
