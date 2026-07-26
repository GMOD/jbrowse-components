// Pack many single-sample BigWigs into one samples-by-bins Zarr v3 store, the
// format MultiWiggleZarrAdapter reads.
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
// The store is written by hand rather than through zarrita's `create`/`set`:
// zarrita's gzip codec is decode-only, and writing the chunk files directly
// keeps the build free of a wasm codec while producing exactly what the browser
// reads back.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'

import { BigWig } from '@gmod/bbi'
import { RemoteFile } from 'generic-filehandle2'

const { values } = parseArgs({
  options: {
    samples: { type: 'string' },
    out: { type: 'string' },
    region: { type: 'string', multiple: true },
    levels: { type: 'string', default: '1000' },
    'chunk-bins': { type: 'string', default: '256' },
    concurrency: { type: 'string', default: '24' },
    help: { type: 'boolean', default: false },
  },
})

if (values.help || !values.samples || !values.out) {
  console.log(
    'usage: node scripts/build_signal_zarr.ts --samples <tsv> --out <dir.zarr> [--region chr:start-end]... [--levels 1000,10000] [--chunk-bins 256] [--concurrency 24]',
  )
  process.exit(values.help ? 0 : 1)
}

const outDir = values.out
const chunkBins = Number(values['chunk-bins'])
const concurrency = Number(values.concurrency)
const levelBinSizes = values.levels
  .split(',')
  .map(Number)
  .sort((a, b) => a - b)
const baseBinSize = levelBinSizes[0]!

interface Sample {
  name: string
  group?: string
  url: string
}

const samples: Sample[] = readFileSync(values.samples, 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .map(line => {
    const cols = line.split('\t')
    return cols.length >= 3
      ? { name: cols[0]!, group: cols[1]!, url: cols[2]! }
      : { name: cols[0]!, url: cols[1]! }
  })

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

const readers = samples.map(s => ({
  ...s,
  bw: new BigWig({ filehandle: new RemoteFile(s.url) }),
}))

console.log(`opening ${readers.length} BigWigs`)
const headers = await pool(readers, concurrency, r => r.bw.getHeader())

// Whole genome means every refName the first file declares, main contigs only:
// the unplaced/random contigs multiply the bin axis without carrying anything a
// cohort figure shows.
const spans: Span[] = values.region?.length
  ? values.region.map(parseRegion)
  : Object.values(headers[0]!.refsByNumber)
      .filter(ref => /^(chr)?([1-9]\d?|X|Y)$/.test(ref.name))
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
console.log(
  `${samples.length} samples x ${baseLayout.totalBins} bins of ${baseBinSize}bp = ${((samples.length * baseLayout.totalBins * 4) / 1e6).toFixed(1)} MB uncompressed`,
)

// The full base-resolution matrix, C order: sample-major rows of the flat bin
// axis. Held in memory because every coarser level is derived from it and the
// chunk writer walks it column-block by column-block.
const matrix = new Float32Array(samples.length * baseLayout.totalBins).fill(
  Number.NaN,
)

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
    // Weighted mean over each output bin, so a source whose own bins are a
    // different size (or offset) than ours still lands on the right values
    // rather than being sampled at one point.
    const sums = new Float64Array(ref.numBins)
    const widths = new Float64Array(ref.numBins)
    for (const f of feats) {
      const score = f.score ?? 0
      const from = Math.max(f.start, ref.start)
      const to = Math.min(f.end, ref.start + ref.numBins * baseBinSize)
      for (let pos = from; pos < to;) {
        const bin = Math.floor((pos - ref.start) / baseBinSize)
        const binEnd = ref.start + (bin + 1) * baseBinSize
        const width = Math.min(to, binEnd) - pos
        sums[bin] = sums[bin]! + score * width
        widths[bin] = widths[bin]! + width
        pos += width
      }
    }
    for (let i = 0; i < ref.numBins; i++) {
      if (widths[i]! > 0) {
        matrix[rowStart + ref.binOffset + i] = sums[i]! / widths[i]!
      }
    }
  }
  done++
  if (done % 100 === 0 || done === readers.length) {
    console.log(`  read ${done}/${readers.length}`)
  }
})

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
    const gz = gzipSync(Buffer.from(buf.buffer, 0, buf.byteLength), {
      level: 9,
    })
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
function downsample(
  values: Float32Array,
  from: { refs: Record<string, RefSpan>; totalBins: number },
  fromBinSize: number,
  to: { refs: Record<string, RefSpan>; totalBins: number },
  toBinSize: number,
  nSamples: number,
) {
  const ratio = toBinSize / fromBinSize
  const out = new Float32Array(nSamples * to.totalBins).fill(Number.NaN)
  for (let s = 0; s < nSamples; s++) {
    for (const [refName, dst] of Object.entries(to.refs)) {
      const src = from.refs[refName]!
      for (let i = 0; i < dst.numBins; i++) {
        let sum = 0
        let n = 0
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
            }
          }
        }
        if (n > 0) {
          out[s * to.totalBins + dst.binOffset + i] = sum / n
        }
      }
    }
  }
  return out
}

rmSync(outDir, { recursive: true, force: true })

const levels = levelBinSizes.map(binSize => {
  const layout = binSize === baseBinSize ? baseLayout : layoutLevel(binSize)
  const values =
    binSize === baseBinSize
      ? matrix
      : downsample(
          matrix,
          baseLayout,
          baseBinSize,
          layout,
          binSize,
          samples.length,
        )
  const path = `bin${binSize}`
  writeLevel(path, values, layout.totalBins, samples.length)
  return { path, binSize, refs: layout.refs }
})

writeJson(join(outDir, 'zarr.json'), {
  zarr_format: 3,
  node_type: 'group',
  attributes: {
    jbrowse_signal_matrix: {
      version: 1,
      samples: samples.map(s =>
        s.group ? { name: s.name, group: s.group } : { name: s.name },
      ),
      levels,
    },
  },
})

console.log(`wrote ${outDir}`)
