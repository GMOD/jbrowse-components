// Pack a cohort's quantitative calls into one samples-by-bins Zarr v3 store, the
// format MultiWiggleZarrAdapter reads. Input is either one BigWig per sample
// (--samples) or one interval BED holding every sample's calls (--bed).
//
// Why: a multi-sample signal track built from N BigWigs is latency-bound, not
// payload-bound. Each file needs its header, chrom B-tree and R-tree index
// before it knows where a region's data lives, so a screen costs 3-4 sequential
// round trips per sample however small the values are. Chunking the same values
// bin-major turns that into a couple of range requests for the whole cohort.
//
// Usage:
//   node scripts/build_signal_zarr.ts \
//     --samples samples.tsv \            # name<TAB>url, or name<TAB>group<TAB>url
//     --out cohort.zarr \
//     --region chr17:36000000-36400000 \ # repeatable; omit for whole genome
//     --levels 1000,10000 \
//     --concurrency 24
//
//   node scripts/build_signal_zarr.ts \
//     --bed tcga_brca_cnv.bed.gz \       # every sample's segments in one file
//     --sample-column sample --value-column segmean \
//     --samples name_group.tsv \         # optional: row order and grouping
//     --out cohort.zarr --levels 10000,100000
//
// Space the levels closer than 10x apart. The adapter reads the coarsest level
// whose bins are still no wider than a screen pixel, so a 10x gap means a view
// landing just under a level's bin size fetches up to 10x more bins than it can
// draw. 10000,30000,100000,... holds that to ~3x.
//
// Every level above the finest is written three times: the mean, and the min
// and max of the finer bins under it, as sibling `<path>_min`/`<path>_max`
// arrays named in the level's metadata. Without them a zoomed-out view can only
// show a mean, and a focal event narrower than a coarse bin averages away at
// exactly the zoom someone would be scanning for it. That triples the coarse
// levels on disk and at peak memory, which is why the spacing above is worth
// getting right: it is what decides how big "the coarse levels" are.
//
// The store is written by hand rather than through zarrita's `create`/`set`:
// zarrita's gzip codec is decode-only, and writing the chunk files directly
// keeps the build free of a wasm codec while producing exactly what the browser
// reads back.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { totalmem } from 'node:os'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { gunzipSync, gzipSync } from 'node:zlib'

const { values } = parseArgs({
  options: {
    samples: { type: 'string' },
    bed: { type: 'string' },
    'sample-column': { type: 'string', default: 'sample' },
    'value-column': { type: 'string', default: 'score' },
    out: { type: 'string' },
    region: { type: 'string', multiple: true },
    levels: { type: 'string', default: '1000' },
    'chunk-bins': { type: 'string', default: '256' },
    decimals: { type: 'string' },
    concurrency: { type: 'string', default: '24' },
    help: { type: 'boolean', default: false },
  },
})

const USAGE = `usage: node scripts/build_signal_zarr.ts --out <dir.zarr> [options]

input, one of:
  --samples <tsv>       one BigWig per sample; name<TAB>url, or name<TAB>group<TAB>url
  --bed <file[.gz]>     one interval BED holding every sample's calls, with a
                        #-prefixed header naming the columns past end. Pair with
                        --samples as a name<TAB>group table to fix row order and
                        attach a group; without it the samples are whatever the
                        file contains, sorted.
      --sample-column   header name of the column holding the sample (default sample)
      --value-column    header name of the column holding the number (default score)

  --region chr:start-end  repeatable; omit for whole genome
  --levels 1000,10000     resolution pyramid, finest first
  --chunk-bins 256        bins per chunk; the sample axis is always whole
  --decimals <n>          round stored values to n decimal places (lossy)
  --concurrency 24        parallel BigWig reads (--samples only)

The last two are the size knobs, and both are read-side transparent: a chunk is
nSamples x chunk-bins values however you set them, and rounding is applied to
the stored bytes, so no reader needs to know either was used.

  --chunk-bins trades requests against bytes per request. A chunk holds every
  sample, so at cohort scale it is large whatever you do: 2504 samples x 256
  bins is 2.5MB before compression, and a view that can only draw 900 rows
  still downloads all of them. Lower it on the coarse levels of a big cohort.

  --decimals is usually the bigger lever, because gzip on this layout is mostly
  matching repeated values rather than modelling a distribution. Copy number
  quantized to 0.01 roughly halves a store; full float32 keeps every digit of a
  number whose last five are noise. Measure your own data before assuming
  either way, and leave it off if the values are genuinely continuous.`

if (values.help || !values.out || !(values.samples || values.bed)) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

const outDir = values.out
const chunkBins = Number(values['chunk-bins'])
// Held as the multiplier rather than the digit count, so the write loop is a
// multiply and a divide instead of a per-value exponentiation.
const roundTo =
  values.decimals === undefined ? undefined : 10 ** Number(values.decimals)
if (roundTo !== undefined && !Number.isFinite(roundTo)) {
  console.error(`--decimals must be a number, got "${values.decimals}"`)
  process.exit(1)
}
const concurrency = Number(values.concurrency)
const levelBinSizes = values.levels
  .split(',')
  .map(Number)
  .sort((a, b) => a - b)
const baseBinSize = levelBinSizes[0]!

interface Sample {
  name: string
  group?: string
  // absent in --bed mode, where every sample's calls live in the one file
  url?: string
}

// In --bed mode this table is optional and only fixes row order and grouping,
// so it is read as name<TAB>group there and name[<TAB>group]<TAB>url otherwise.
function readSampleTable(path: string, withUrl: boolean): Sample[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const cols = line.split('\t')
      if (!withUrl) {
        return { name: cols[0]!, group: cols[1] || undefined }
      }
      return cols.length >= 3
        ? { name: cols[0]!, group: cols[1]!, url: cols[2]! }
        : { name: cols[0]!, url: cols[1]! }
    })
}

interface Span {
  refName: string
  start: number
  end: number
}

function parseRegion(text: string): Span {
  const m = /^(.+):([\d,]+)-([\d,]+)$/.exec(text)
  if (!m) {
    throw new Error(`bad --region "${text}", want chr:start-end`)
  }
  return {
    refName: m[1]!,
    start: Number(m[2]!.replaceAll(',', '')),
    end: Number(m[3]!.replaceAll(',', '')),
  }
}

async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const out = new globalThis.Array<R>(items.length)
  let next = 0
  await Promise.all(
    globalThis.Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (next < items.length) {
          const index = next++
          out[index] = await fn(items[index]!, index)
        }
      },
    ),
  )
  return out
}

// Unplaced/random contigs multiply the bin axis without carrying anything a
// cohort figure shows, so "whole genome" means the main ones.
const MAIN_CONTIG = /^(chr)?([1-9]\d?|X|Y)$/

// Natural order, so the bin axis runs chr1..chr22,X,Y rather than the string
// sort's chr1, chr10, chr11.
function contigRank(name: string) {
  const bare = name.replace(/^chr/, '')
  return bare === 'X' ? 23 : bare === 'Y' ? 24 : Number(bare)
}

// One interval BED holding every sample's calls: the shape
// build_tcga_cohort_cnv.sh already writes, and the shape any per-sample segment
// caller can be coerced into. Read whole rather than streamed — a cohort of
// piecewise-constant calls is a few hundred thousand rows, and both the sample
// list and the contig extents are derived from it before any binning starts.
interface Interval {
  refName: string
  start: number
  end: number
  sample: string
  value: number
}

function readBed(path: string, sampleColumn: string, valueColumn: string) {
  const raw = readFileSync(path)
  const text = (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')
  const lines = text.split('\n')
  // The convention build_tcga_cohort_cnv.sh writes and BedTabixAdapter reads:
  // a #-prefixed first line naming the columns, including the ones past `end`.
  const header = lines[0]?.startsWith('#')
    ? lines[0].slice(1).split('\t')
    : undefined
  if (!header) {
    throw new Error(
      `${path} has no #-prefixed header line, so there is no way to find the "${sampleColumn}" and "${valueColumn}" columns`,
    )
  }
  const sampleIdx = header.indexOf(sampleColumn)
  const valueIdx = header.indexOf(valueColumn)
  for (const [name, idx] of [
    [sampleColumn, sampleIdx],
    [valueColumn, valueIdx],
  ] as const) {
    if (idx < 0) {
      throw new Error(
        `${path} has no "${name}" column; its header is ${header.join(', ')}`,
      )
    }
  }
  const out: Interval[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!
    if (!line) {
      continue
    }
    const cols = line.split('\t')
    const value = Number(cols[valueIdx])
    // A call with no number is not a zero — drop it rather than bin it as one
    if (Number.isNaN(value)) {
      continue
    }
    out.push({
      refName: cols[0]!,
      start: Number(cols[1]),
      end: Number(cols[2]),
      sample: cols[sampleIdx]!,
      value,
    })
  }
  return out
}

const intervals = values.bed
  ? readBed(values.bed, values['sample-column'], values['value-column'])
  : undefined

let samples: Sample[]
if (intervals) {
  const present = new Set(intervals.map(i => i.sample))
  samples = values.samples
    ? readSampleTable(values.samples, false).filter(s => present.has(s.name))
    : [...present].sort().map(name => ({ name }))
  console.log(
    `${intervals.length} intervals over ${present.size} samples in ${values.bed}${
      values.samples
        ? `, ${samples.length} of them named in ${values.samples}`
        : ''
    }`,
  )
} else {
  samples = readSampleTable(values.samples!, true)
}
if (samples.length === 0) {
  throw new Error(
    intervals
      ? `no samples to build from: ${values.samples ? `nothing in ${values.samples} matched a "${values['sample-column']}" value in ${values.bed} — check that the column exists and that the names are spelled the same way` : `${values.bed} yielded no intervals`}`
      : `no samples listed in ${values.samples}`,
  )
}

// Imported here rather than at the top so that --bed mode, which never opens a
// BigWig, needs no npm packages at all: build_tcga_cohort_cnv.sh can run the
// converter with nothing but node.
const readers = intervals
  ? []
  : await (async () => {
      const [{ BigWig }, { RemoteFile }] = await Promise.all([
        import('@gmod/bbi'),
        import('generic-filehandle2'),
      ])
      return samples.map(s => ({
        ...s,
        bw: new BigWig({ filehandle: new RemoteFile(s.url!) }),
      }))
    })()

if (readers.length) {
  console.log(`opening ${readers.length} BigWigs`)
}
const headers = readers.length
  ? await pool(readers, concurrency, r => r.bw.getHeader())
  : []

// Whole genome means every main contig the input declares: the BigWig header
// knows the true lengths, and a BED only knows how far its own calls reach —
// which for calls that tile the genome is the same answer to within a telomere,
// and bins past it would have been unmeasured anyway.
const spans: Span[] = values.region?.length
  ? values.region.map(parseRegion)
  : intervals
    ? [
        ...intervals
          .filter(i => MAIN_CONTIG.test(i.refName))
          .reduce(
            (m, i) => m.set(i.refName, Math.max(m.get(i.refName) ?? 0, i.end)),
            new Map<string, number>(),
          ),
      ]
        .map(([refName, end]) => ({ refName, start: 0, end }))
        .sort((a, b) => contigRank(a.refName) - contigRank(b.refName))
    : Object.values(headers[0]!.refsByNumber)
        .filter(ref => MAIN_CONTIG.test(ref.name))
        .map(ref => ({ refName: ref.name, start: 0, end: ref.length }))

// Every level shares one bin axis layout, so a refName's slot is the same
// fraction of every level and the adapter can switch levels without remapping.
interface RefSpan {
  start: number
  binOffset: number
  numBins: number
}

function layoutLevel(binSize: number) {
  const refs: Record<string, RefSpan> = {}
  let binOffset = 0
  for (const span of spans) {
    const start = Math.floor(span.start / binSize) * binSize
    const numBins = Math.ceil((span.end - start) / binSize)
    refs[span.refName] = { start, binOffset, numBins }
    binOffset += numBins
  }
  return { refs, totalBins: binOffset }
}

const baseLayout = layoutLevel(baseBinSize)
const baseBytes = samples.length * baseLayout.totalBins * 4
console.log(
  `${samples.length} samples x ${baseLayout.totalBins} bins of ${baseBinSize}bp = ${(baseBytes / 1e6).toFixed(1)} MB uncompressed`,
)

// The base level is held whole for the entire run (every coarser level derives
// from it), so the first entry of --levels is what decides whether a run is
// possible at all, and dropping --region without touching it is how you find
// that out the hard way: over hg38 a 2504-sample panel is ~3 GB of matrix at
// 10kb bins and ~31 GB at 1kb. Refused here rather than left to the OOM killer,
// which reports a dead process and nothing about which knob turns it.
//
// Peak is the base plus the widest coarse level's mean/min/max, which are
// allocated together beside it. Computed from the actual levels rather than
// assumed, because the ratio between them is the user's to choose: at the ~3x
// spacing this asks for, the summary triple costs about as much again as the
// base, and at 10x spacing it is nearly free.
function levelBytes(binSize: number) {
  return samples.length * layoutLevel(binSize).totalBins * 4
}

function peakBytes(binSizes: number[]) {
  const [finest, ...coarser] = binSizes
  return (
    levelBytes(finest!) +
    Math.max(0, ...coarser.map(binSize => 3 * levelBytes(binSize)))
  )
}

const memBudget = totalmem() / 2
const peak = peakBytes(levelBinSizes)
if (peak > memBudget) {
  let suggestion: number[] | undefined
  for (let decade = baseBinSize; !suggestion && decade <= 1e9; decade *= 10) {
    for (const step of [1, 2, 5]) {
      const bin = decade * step
      const candidate = [bin, bin * 3, bin * 10]
      if (bin > baseBinSize && peakBytes(candidate) <= memBudget) {
        suggestion = candidate
        break
      }
    }
  }
  console.error(
    `the ${baseBinSize}bp level is ${(baseBytes / 1e9).toFixed(1)} GB and is held whole in memory (${(peak / 1e9).toFixed(1)} GB at peak, with the coarser levels' mean/min/max beside it), over this machine's ${(memBudget / 1e9).toFixed(1)} GB budget.
Coarsen the finest level (or narrow the input with --region):${suggestion ? ` --levels ${suggestion.join(',')}` : ' no bin size up to 1Gb fits, so use --region'}`,
  )
  process.exit(1)
}

// The full base-resolution matrix, C order: sample-major rows of the flat bin
// axis. Held in memory because every coarser level is derived from it and the
// chunk writer walks it column-block by column-block.
const matrix = new Float32Array(samples.length * baseLayout.totalBins).fill(
  Number.NaN,
)

// Weighted mean over each output bin, so an input whose own intervals are a
// different size (or offset) than ours lands on the right value rather than
// being sampled at one point. A BigWig's fixed-width values and a caller's
// megabase segments both go through this, which is what keeps the two input
// modes from disagreeing at a bin boundary.
interface Bins {
  ref: RefSpan
  sums: Float64Array
  widths: Float64Array
}

function makeBins(ref: RefSpan): Bins {
  return {
    ref,
    sums: new Float64Array(ref.numBins),
    widths: new Float64Array(ref.numBins),
  }
}

function addInterval(bins: Bins, start: number, end: number, score: number) {
  const { ref, sums, widths } = bins
  const from = Math.max(start, ref.start)
  const to = Math.min(end, ref.start + ref.numBins * baseBinSize)
  for (let pos = from; pos < to;) {
    const bin = Math.floor((pos - ref.start) / baseBinSize)
    const binEnd = ref.start + (bin + 1) * baseBinSize
    const width = Math.min(to, binEnd) - pos
    sums[bin] = sums[bin]! + score * width
    widths[bin] = widths[bin]! + width
    pos += width
  }
}

function writeBins(bins: Bins, target: Float32Array, rowStart: number) {
  const { ref, sums, widths } = bins
  for (let i = 0; i < ref.numBins; i++) {
    if (widths[i]! > 0) {
      target[rowStart + ref.binOffset + i] = sums[i]! / widths[i]!
    }
  }
}

if (intervals) {
  const rowOf = new Map(samples.map((s, i) => [s.name, i]))
  // Bucketed by sample first: one accumulator per (sample, ref) is allocated
  // and drained once, rather than one per interval or one kept alive for the
  // whole cohort.
  const bySample = new Map<number, Interval[]>()
  for (const interval of intervals) {
    const row = rowOf.get(interval.sample)
    if (row === undefined || !baseLayout.refs[interval.refName]) {
      continue
    }
    const list = bySample.get(row)
    if (list) {
      list.push(interval)
    } else {
      bySample.set(row, [interval])
    }
  }
  let done = 0
  for (const [sampleIndex, list] of bySample) {
    const rowStart = sampleIndex * baseLayout.totalBins
    const accumulators = new Map<string, Bins>()
    for (const interval of list) {
      let acc = accumulators.get(interval.refName)
      if (!acc) {
        acc = makeBins(baseLayout.refs[interval.refName]!)
        accumulators.set(interval.refName, acc)
      }
      addInterval(acc, interval.start, interval.end, interval.value)
    }
    for (const acc of accumulators.values()) {
      writeBins(acc, matrix, rowStart)
    }
    done++
    if (done % 200 === 0 || done === bySample.size) {
      console.log(`  binned ${done}/${bySample.size}`)
    }
  }
} else {
  let done = 0
  await pool(readers, concurrency, async (reader, sampleIndex) => {
    const rowStart = sampleIndex * baseLayout.totalBins
    for (const span of spans) {
      const ref = baseLayout.refs[span.refName]!
      const feats = await reader.bw.getFeatures(
        span.refName,
        span.start,
        span.end,
        { basesPerSpan: 1 },
      )
      const acc = makeBins(ref)
      for (const f of feats) {
        addInterval(acc, f.start, f.end, f.score ?? 0)
      }
      writeBins(acc, matrix, rowStart)
    }
    done++
    if (done % 100 === 0 || done === readers.length) {
      console.log(`  read ${done}/${readers.length}`)
    }
  })
}

// Compact, not pretty: the group's metadata carries one entry per sample, and
// at cohort scale that file is the first thing every reader downloads.
function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value))
}

// One chunk spans every sample over `chunkBins` bins, which is the whole point:
// a screenful of the cohort is one or two of these, not one read per sample.
function writeLevel(
  path: string,
  values: Float32Array,
  totalBins: number,
  nSamples: number,
) {
  const numChunks = Math.ceil(totalBins / chunkBins)
  writeJson(join(outDir, path, 'zarr.json'), {
    zarr_format: 3,
    node_type: 'array',
    shape: [nSamples, totalBins],
    data_type: 'float32',
    chunk_grid: {
      name: 'regular',
      configuration: { chunk_shape: [nSamples, chunkBins] },
    },
    chunk_key_encoding: { name: 'default', configuration: { separator: '/' } },
    fill_value: 'NaN',
    codecs: [
      { name: 'bytes', configuration: { endian: 'little' } },
      { name: 'gzip', configuration: { level: 9 } },
    ],
    attributes: {},
  })
  let bytes = 0
  const buf = new Float32Array(nSamples * chunkBins)
  for (let c = 0; c < numChunks; c++) {
    buf.fill(Number.NaN)
    const from = c * chunkBins
    const width = Math.min(chunkBins, totalBins - from)
    for (let s = 0; s < nSamples; s++) {
      buf.set(
        values.subarray(s * totalBins + from, s * totalBins + from + width),
        s * chunkBins,
      )
    }
    // Rounded here, at write time, rather than on the matrix: the coarser
    // levels derive from the full-precision base, so this loses precision once
    // in the stored bytes instead of compounding it through the pyramid.
    if (roundTo !== undefined) {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = Math.round(buf[i]! * roundTo) / roundTo
      }
    }
    // `buf.byteOffset`, not 0: they are equal only because `buf` is freshly
    // allocated here. The day it becomes a subarray of a bigger buffer, a
    // hardcoded 0 silently gzips somebody else's bytes.
    const gz = gzipSync(
      Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength),
      {
        level: 9,
      },
    )
    const file = join(outDir, path, 'c', '0', String(c))
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, gz)
    bytes += gz.byteLength
  }
  console.log(
    `  ${path}: ${numChunks} chunks, ${(bytes / 1e6).toFixed(2)} MB on disk`,
  )
  return bytes
}

// A coarser level averages the finer bins under it, skipping the unmeasured
// ones, so a gap stays a gap instead of being diluted toward zero.
//
// It also keeps their min and max, which is the difference between a pyramid
// and a set of separately-binned tracks: a mean is not a summary on its own. A
// focal amplification inside a 1Mb bin averages back to the diploid baseline
// and disappears at the zoom where someone is most likely to be looking for it,
// and there is nothing in a mean-only store that could bring it back. BigWig's
// zoom records carry validCount/min/max/sum/sumSquares for exactly this reason,
// and @jbrowse/plugin-wiggle already renders min and max as their own layers
// when an adapter supplies them (`summaryScoreMode` whiskers/min/max).
//
// The min and max are over this store's own finer bins, not over whatever the
// input was, and only levels above the base carry them. That keeps the claim
// honest: the base level is the finest thing the store knows, so a summary of
// something below it would be a resolution the store cannot show anywhere else.
function downsample(
  values: Float32Array,
  from: { refs: Record<string, RefSpan>; totalBins: number },
  fromBinSize: number,
  to: { refs: Record<string, RefSpan>; totalBins: number },
  toBinSize: number,
  nSamples: number,
) {
  const ratio = toBinSize / fromBinSize
  const mean = new Float32Array(nSamples * to.totalBins).fill(Number.NaN)
  const min = new Float32Array(nSamples * to.totalBins).fill(Number.NaN)
  const max = new Float32Array(nSamples * to.totalBins).fill(Number.NaN)
  for (let s = 0; s < nSamples; s++) {
    for (const [refName, dst] of Object.entries(to.refs)) {
      const src = from.refs[refName]!
      for (let i = 0; i < dst.numBins; i++) {
        let sum = 0
        let n = 0
        let lo = Number.POSITIVE_INFINITY
        let hi = Number.NEGATIVE_INFINITY
        const base = Math.round(
          (dst.start - src.start) / fromBinSize + i * ratio,
        )
        for (let j = 0; j < ratio; j++) {
          const idx = base + j
          if (idx >= 0 && idx < src.numBins) {
            const v = values[s * from.totalBins + src.binOffset + idx]!
            if (!Number.isNaN(v)) {
              sum += v
              n++
              if (v < lo) {
                lo = v
              }
              if (v > hi) {
                hi = v
              }
            }
          }
        }
        if (n > 0) {
          const at = s * to.totalBins + dst.binOffset + i
          mean[at] = sum / n
          min[at] = lo
          max[at] = hi
        }
      }
    }
  }
  return { mean, min, max }
}

rmSync(outDir, { recursive: true, force: true })

// `minPath`/`maxPath` are additive: a reader that predates them opens `path`
// and behaves exactly as before, which is why they are sibling arrays rather
// than a third axis on the existing one. Both or neither, since a min without a
// max is not a summary anything can draw.
const levels = levelBinSizes.map(binSize => {
  const path = `bin${binSize}`
  if (binSize === baseBinSize) {
    writeLevel(path, matrix, baseLayout.totalBins, samples.length)
    return { path, binSize, refs: baseLayout.refs }
  }
  const layout = layoutLevel(binSize)
  const { mean, min, max } = downsample(
    matrix,
    baseLayout,
    baseBinSize,
    layout,
    binSize,
    samples.length,
  )
  writeLevel(path, mean, layout.totalBins, samples.length)
  writeLevel(`${path}_min`, min, layout.totalBins, samples.length)
  writeLevel(`${path}_max`, max, layout.totalBins, samples.length)
  return {
    path,
    binSize,
    refs: layout.refs,
    minPath: `${path}_min`,
    maxPath: `${path}_max`,
  }
})

writeJson(join(outDir, 'zarr.json'), {
  zarr_format: 3,
  node_type: 'group',
  attributes: {
    jbrowse_signal_matrix: {
      // 2 adds per-level minPath/maxPath. A reader should key off their
      // presence rather than off this number: they are optional (the base level
      // has none) and additive, so a v1 reader opens a v2 store correctly.
      version: 2,
      samples: samples.map(s =>
        s.group ? { name: s.name, group: s.group } : { name: s.name },
      ),
      levels,
      // Provenance, not instruction: the values are already rounded in the
      // stored bytes, so nothing reads this to decode them. It is here so a
      // store can be asked what precision it actually carries, which is
      // otherwise unrecoverable once the digits are gone.
      ...(values.decimals === undefined
        ? {}
        : { decimals: Number(values.decimals) }),
    },
  },
})

console.log(`wrote ${outDir}`)
