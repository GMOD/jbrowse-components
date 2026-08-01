// Measure what one window of a multi-sample signal track costs over the wire,
// both ways: one BigWig per sample against one samples-by-bins Zarr store. The
// scaling section of website/docs/tutorials/population_cnv.md quotes this
// script's output rather than asserting the numbers, since they are the whole
// argument for the second format.
//
// Requests are counted by wrapping fetch, so the count includes every header,
// index and data read the reader makes, not just the ones we asked for. Byte
// totals come from the same wrapper.
//
// The BigWig list comes either from a `name<TAB>url` TSV (what
// build_signal_zarr.ts consumes) or straight out of a JBrowse config's
// MultiWiggle track, so the two halves measure the same files a figure draws.
//
// Usage:
//   node scripts/measure_signal_latency.ts \
//     --region chr17:36,080,000-36,270,000 \
//     --config test_data/config_demo.json --track pur_copynumber_1000g \
//     --zarr https://jbrowse.org/code/jb2/main/test_data/1000g_cnv/qm2_cn_1kb.zarr
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { BigWig } from '@gmod/bbi'
import { RemoteFile } from 'generic-filehandle2'

const { values } = parseArgs({
  options: {
    samples: { type: 'string' },
    config: { type: 'string' },
    track: { type: 'string' },
    zarr: { type: 'string' },
    region: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '24' },
    pixels: { type: 'string', default: '1500' },
    pings: { type: 'string', default: '5' },
    help: { type: 'boolean', default: false },
  },
})

if (
  values.help ||
  !values.region ||
  !(values.samples || values.config || values.zarr)
) {
  console.log(
    'usage: node scripts/measure_signal_latency.ts --region chr:start-end ' +
      '[--samples <tsv> | --config <config.json> --track <trackId>] [--zarr <url>] ' +
      '[--limit N] [--concurrency N] [--pixels N]',
  )
  process.exit(values.help ? 0 : 1)
}

const m = /^(.+):([\d,]+)-([\d,]+)$/.exec(values.region)
if (!m) {
  throw new Error(`bad --region "${values.region}", want chr:start-end`)
}
const refName = m[1]!
const start = Number(m[2]!.replaceAll(',', ''))
const end = Number(m[3]!.replaceAll(',', ''))
const pixels = Number(values.pixels)
const basesPerSpan = Math.max(1, Math.round((end - start) / pixels))

function counting() {
  let requests = 0
  let bytes = 0
  const wrapped = async (input: RequestInfo, init?: RequestInit) => {
    requests++
    const res = await globalThis.fetch(input, init)
    const buf = await res.arrayBuffer()
    bytes += buf.byteLength
    return new Response(buf, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    })
  }
  return { wrapped, read: () => ({ requests, bytes }) }
}

async function pool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  let next = 0
  await Promise.all(
    globalThis.Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (next < items.length) {
          const index = next++
          await fn(items[index]!, index)
        }
      },
    ),
  )
}

function report(
  label: string,
  ms: number,
  count: { requests: number; bytes: number },
) {
  console.log(
    `${label.padEnd(28)} ${String(count.requests).padStart(6)} requests  ` +
      `${(count.bytes / 1e6).toFixed(2).padStart(7)} MB  ${(ms / 1000).toFixed(1).padStart(6)} s`,
  )
}

// One range request's round trip, so the request counts above can be read as a
// cost rather than as a number.
async function pingLatency(url: string) {
  const times: number[] = []
  for (let i = 0; i < Number(values.pings); i++) {
    const from = i * 1024
    const t0 = performance.now()
    await globalThis.fetch(url, {
      headers: { range: `bytes=${from}-${from + 1023}` },
    })
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]!
}

console.log(
  `${refName}:${start}-${end} at ${basesPerSpan} bp per pixel column\n`,
)

interface WiggleTrack {
  trackId: string
  adapter: { bigWigs?: string[] }
}

function urlsFromConfig(file: string, trackId: string) {
  const config = JSON.parse(readFileSync(file, 'utf8')) as {
    tracks: WiggleTrack[]
  }
  const track = config.tracks.find(t => t.trackId === trackId)
  if (!track?.adapter.bigWigs) {
    throw new Error(`${file} has no track "${trackId}" with a bigWigs list`)
  }
  return track.adapter.bigWigs
}

function urlsFromTsv(file: string) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('\t').at(-1)!)
}

if (values.samples || values.config) {
  const all = values.config
    ? urlsFromConfig(values.config, values.track ?? '')
    : urlsFromTsv(values.samples!)
  const urls = all.slice(0, values.limit ? Number(values.limit) : undefined)

  const { wrapped, read } = counting()
  const t0 = performance.now()
  await pool(urls, Number(values.concurrency), async url => {
    const bw = new BigWig({
      filehandle: new RemoteFile(url, { fetch: wrapped }),
    })
    await bw.getHeader()
    await bw.getFeatures(refName, start, end, { basesPerSpan })
  })
  const elapsed = performance.now() - t0
  const count = read()
  report(`${urls.length} BigWigs`, elapsed, count)
  console.log(
    `${''.padEnd(28)} ${(count.requests / urls.length).toFixed(1)} requests per file`,
  )
  console.log(
    `${''.padEnd(28)} median range request ${(await pingLatency(urls[0]!)).toFixed(0)} ms\n`,
  )
}

if (values.zarr) {
  const base = values.zarr.replace(/\/$/, '')
  const { wrapped, read } = counting()
  const t0 = performance.now()

  const group = (await (await wrapped(`${base}/zarr.json`)).json()) as {
    attributes: {
      jbrowse_signal_matrix: {
        samples: { name: string }[]
        levels: {
          path: string
          binSize: number
          refs: Record<
            string,
            { start: number; binOffset: number; numBins: number }
          >
        }[]
      }
    }
  }
  // Finest level, which is what a window this size draws from.
  const level = group.attributes.jbrowse_signal_matrix.levels[0]!
  const array = (await (
    await wrapped(`${base}/${level.path}/zarr.json`)
  ).json()) as {
    chunk_grid: { configuration: { chunk_shape: [number, number] } }
  }
  const [nSamples, chunkBins] = array.chunk_grid.configuration.chunk_shape

  const ref = level.refs[refName]
  if (!ref) {
    throw new Error(
      `${refName} is not in the store, which holds ${Object.keys(level.refs).join(', ')}`,
    )
  }
  const firstBin =
    ref.binOffset + Math.floor((start - ref.start) / level.binSize)
  const lastBin = ref.binOffset + Math.floor((end - ref.start) / level.binSize)
  const chunks: number[] = []
  for (
    let c = Math.floor(firstBin / chunkBins);
    c <= Math.floor(lastBin / chunkBins);
    c++
  ) {
    chunks.push(c)
  }
  await Promise.all(chunks.map(c => wrapped(`${base}/${level.path}/c/0/${c}`)))

  const elapsed = performance.now() - t0
  report(`Zarr store, ${nSamples} samples`, elapsed, read())
  console.log(
    `${''.padEnd(28)} 2 metadata + ${chunks.length} chunk${chunks.length === 1 ? '' : 's'} of ${nSamples} x ${chunkBins}`,
  )
}
