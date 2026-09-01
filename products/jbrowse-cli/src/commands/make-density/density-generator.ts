import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

// Which parser a filename selects. BAM/CRAM/SAM are named so the refusal can
// say what to do instead, rather than falling into the unknown-extension case.
const formats = [
  { regex: /\.gff3?(\.b?gz)?$/i, format: 'gff3' },
  { regex: /\.gtf(\.b?gz)?$/i, format: 'gtf' },
  { regex: /\.vcf(\.b?gz)?$/i, format: 'vcf' },
  { regex: /\.bed(\.b?gz)?$/i, format: 'bed' },
] as const

export type DensityFormat = (typeof formats)[number]['format']

const alignmentFormat = /\.(bam|cram|sam)$/i

export function densityFormat(file: string): DensityFormat {
  const hit = formats.find(f => f.regex.test(file))
  if (!hit) {
    throw new Error(
      alignmentFormat.test(file)
        ? `${file} is an alignment file, which make-density cannot read. Count coverage with a tool that reads BAM/CRAM (e.g. "bamCoverage" or "samtools depth" piped to bedGraphToBigWig) and pass the result with add-track --density.`
        : `Cannot tell what kind of file ${file} is. make-density reads GFF3, GTF, BED and VCF, plain or bgzipped.`,
    )
  }
  return hit.format
}

/**
 * The reference name and 0-based start of one record, or undefined for a line
 * that contributes nothing: a header, a directive, a short line, or — in GFF3 —
 * a child feature, whose start would count its parent's locus a second time.
 * GTF, BED and VCF have no parent link to follow, so every record counts.
 */
function parseRecord(line: string, format: DensityFormat) {
  const columns = line.split('\t')
  const refName = columns[0]
  const startsHeader =
    line.startsWith('#') ||
    line.startsWith('track ') ||
    line.startsWith('browser ')
  if (startsHeader || refName === undefined || refName === '') {
    return undefined
  }
  if (format === 'bed') {
    const start = columns[1]
    return start === undefined ? undefined : { refName, start: +start }
  }
  const start = columns[format === 'vcf' ? 1 : 3]
  const attributes = columns[8]
  const isChild = format === 'gff3' && attributes?.includes('Parent=')
  return start === undefined || isChild
    ? undefined
    : { refName, start: +start - 1 }
}

export interface DensityCounts {
  /** refName -> bin index -> feature starts in that bin */
  bins: Map<string, Map<number, number>>
  records: number
  /** names the file uses that the chrom.sizes does not, so nothing is silently dropped */
  unknownRefNames: Set<string>
}

function tally(
  bins: Map<string, Map<number, number>>,
  key: string,
  bin: number,
) {
  const existing = bins.get(key)
  const perRef = existing === undefined ? new Map<number, number>() : existing
  if (existing === undefined) {
    bins.set(key, perRef)
  }
  const count = perRef.get(bin)
  perRef.set(bin, count === undefined ? 1 : count + 1)
}

export async function countFeatureStarts({
  file,
  format,
  binSize,
  chromSizes,
}: {
  file: string
  format: DensityFormat
  binSize: number
  chromSizes: Map<string, number>
}): Promise<DensityCounts> {
  const bins = new Map<string, Map<number, number>>()
  const unknownRefNames = new Set<string>()
  let records = 0
  const source = createReadStream(file)
  const lines = createInterface({
    input: /\.b?gz$/i.test(file) ? source.pipe(createGunzip()) : source,
    crlfDelay: Number.POSITIVE_INFINITY,
  })
  for await (const line of lines) {
    // everything after a GFF3 ##FASTA directive is sequence, not features
    if (line.trimEnd() === '##FASTA') {
      break
    }
    const record = parseRecord(line, format)
    if (record && Number.isFinite(record.start)) {
      records++
      const length = chromSizes.get(record.refName)
      if (length === undefined) {
        unknownRefNames.add(record.refName)
      } else if (record.start >= 0 && record.start < length) {
        tally(bins, record.refName, Math.floor(record.start / binSize))
      }
    }
  }
  lines.close()
  source.destroy()
  return { bins, records, unknownRefNames }
}

/**
 * bedGraph rows covering every base of every reference, in the order
 * bedGraphToBigWig demands (`sort -k1,1 -k2,2n`): one row per counted bin,
 * clipped to the reference's length, and one per run of empty bins between
 * them. The empty runs are load-bearing: a bigWig's zoom levels average over
 * the bases its rows cover, so a file that skipped them would read, zoomed out,
 * as the mean over the bins that held something rather than over the span, and
 * a gene desert beside a cluster would score the same.
 */
export function* bedGraphLines({
  bins,
  chromSizes,
  binSize,
}: {
  bins: Map<string, Map<number, number>>
  chromSizes: Map<string, number>
  binSize: number
}): Generator<string> {
  const byName = [...chromSizes.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  for (const [refName, length] of byName) {
    const perRef = bins.get(refName)
    const counted = perRef
      ? [...perRef.entries()].sort(([a], [b]) => a - b)
      : []
    let cursor = 0
    for (const [bin, count] of counted) {
      const start = bin * binSize
      const end = Math.min(start + binSize, length)
      if (start > cursor) {
        yield `${refName}\t${cursor}\t${start}\t0\n`
      }
      yield `${refName}\t${start}\t${end}\t${count}\n`
      cursor = end
    }
    if (cursor < length) {
      yield `${refName}\t${cursor}\t${length}\t0\n`
    }
  }
}

export function chromSizesLines(chromSizes: Map<string, number>) {
  return [...chromSizes.entries()]
    .map(([refName, length]) => `${refName}\t${length}\n`)
    .join('')
}

// a `.chrom.sizes` and a `.fai` both put the name in column 1 and the length in
// column 2, so one parser reads either
function parseChromSizes(text: string, source: string) {
  const sizes = new Map<string, number>()
  for (const line of text.split('\n')) {
    const [refName, length] = line.split('\t')
    if (refName && length !== undefined && Number.isFinite(+length)) {
      sizes.set(refName, +length)
    }
  }
  if (sizes.size === 0) {
    throw new Error(`No reference sequences found in ${source}`)
  }
  return sizes
}

/**
 * The reference lengths the bigWig header needs, from an explicit
 * `--chrom-sizes` or from the `.fai` beside an `--assembly` FASTA.
 */
export function resolveChromSizes({
  chromSizes,
  assembly,
}: {
  chromSizes?: string
  assembly?: string
}) {
  if (chromSizes !== undefined) {
    return parseChromSizes(readFileSync(chromSizes, 'utf8'), chromSizes)
  }
  if (assembly !== undefined) {
    const fai = `${assembly}.fai`
    if (!existsSync(fai)) {
      throw new Error(
        `No index beside ${assembly}: expected ${fai}. Make one with "samtools faidx ${assembly}", or pass --chrom-sizes instead.`,
      )
    }
    return parseChromSizes(readFileSync(fai, 'utf8'), fai)
  }
  throw new Error(
    'Reference lengths are required: pass --chrom-sizes <file> or --assembly <fasta> (whose .fai is read)',
  )
}

export function parseBinSize(bin: string) {
  const binSize = +bin
  if (!Number.isInteger(binSize) || binSize < 1) {
    throw new Error(`--bin must be a positive whole number of bp, got ${bin}`)
  }
  return binSize
}
