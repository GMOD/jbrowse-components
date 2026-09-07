/* eslint-disable no-console */
/// <reference types="@webgpu/types" />
// "Cluster by genotype" split at its seam: the sample-by-sample distance
// build on the WebGPU kernel clusterMatrix dispatches (the shipped
// `gpuDistanceMatrix`, bundled into the page as is), then @gmod/hclust's
// merge loop on the matrix that comes back, against hclust building the same
// matrix in wasm. The GPU result is checked against an f64 reference, and the
// tree it yields against the wasm's own.
//
// Headed Chrome, because headless has no WebGPU (see profile-zoom.ts).
//
//     node browser-tests/probe-gpu-distance-matrix.ts [N] [V] [--fractional]
//     node browser-tests/probe-gpu-distance-matrix.ts --matrix=<file.bin> [--skip-cpu]
//
// `--fractional` swaps the 0/1/2 dosages for the shape buildIdentityMatrix
// emits (per-bin identity in [0,1], with dropouts at 0). Integer dosages make
// the f32 partial sums exact, so the dosage mode cannot see accumulation error
// at all; the fractional one is what says whether the kernel's blocked sum
// holds at a long V.
//
// N=2504 is 1000 Genomes in sample mode, 5008 in phased mode; V=3000 is a
// 100 kb window at the default MAF filter, 22000 a 1 Mb one. --matrix reads a
// real one instead: the layout `pnpm bench:real --dump=<dir>` writes in the
// hclust repo (uint32 rows, uint32 columns, float32 row-major), so both sides
// of the comparison see the identical input.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { buildSync } from 'esbuild'
import puppeteer from 'puppeteer'

import { clusterMatrix } from '../../../packages/tree-sidebar/src/clusterMatrix.ts'

const here = dirname(fileURLToPath(import.meta.url))
const treeSidebar = join(here, '../../../packages/tree-sidebar')

interface ClusterResult {
  tree: unknown
  order: number[]
}
// hclust is tree-sidebar's dependency, not this package's, so it resolves
// from there.
const { clusterData } = createRequire(join(treeSidebar, 'package.json'))(
  '@gmod/hclust',
) as {
  clusterData: (opts: {
    data?: ArrayLike<number>[]
    distances?: Float32Array
    onProgress?: () => void
  }) => Promise<ClusterResult>
}
const matrixArg = process.argv.find(a => a.startsWith('--matrix='))
const matrixFile = matrixArg?.slice('--matrix='.length)
const skipCpu = process.argv.includes('--skip-cpu')
const fractional = process.argv.includes('--fractional')
const positional = process.argv.slice(2).filter(a => !a.startsWith('--'))
const N = Number(positional[0] ?? 2504)
const V = Number(positional[1] ?? 3000)

function readMatrix(file: string) {
  const buf = readFileSync(file)
  const [rows, cols] = new Uint32Array(buf.buffer, buf.byteOffset, 2)
  const data = new Float32Array(
    buf.buffer.slice(
      buf.byteOffset + 8,
      buf.byteOffset + 8 + rows! * cols! * 4,
    ),
  )
  return { n: rows!, v: cols!, data }
}
const MAC_CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// 0/1/2 dosages at a per-site allele frequency, the shape getGenotypeMatrix
// emits for a diploid panel with no missing calls. Same generator on both
// sides so the CPU and GPU runs see one matrix.
function genotypes(n: number, v: number, seed: number, fractional: boolean) {
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const out = new Float32Array(n * v)
  if (fractional) {
    // buildIdentityMatrix's shape: one row per genome, one column per bin,
    // valued as the fraction of the bin at which the genome both aligns and
    // matches the reference. Mass near 1 (conserved), a divergent tail, and
    // exact 0 for dropout runs. Row 0 is the reference.
    const conservation = Float32Array.from(
      { length: v },
      () => 0.9 + rnd() * 0.1,
    )
    for (let i = 0; i < n; i++) {
      const divergence = i === 0 ? 0 : rnd() * 0.08
      for (let j = 0; j < v; j++) {
        const drop = i > 0 && rnd() < 0.015
        out[i * v + j] = drop
          ? 0
          : Math.max(0, Math.min(1, conservation[j]! - divergence * rnd()))
      }
    }
    return out
  }
  const freqs = Float32Array.from({ length: v }, () => 0.05 + rnd() * 0.45)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < v; j++) {
      const p = freqs[j]!
      out[i * v + j] = (rnd() < p ? 1 : 0) + (rnd() < p ? 1 : 0)
    }
  }
  return out
}

interface GpuResult {
  adapter: string
  ms: number
  maxRelErr: number
  checkedPairs: number
}

declare global {
  interface Window {
    genotypes: typeof genotypes
    jbgpu: {
      gpuDistanceMatrix: (
        rows: ArrayLike<number>[],
      ) => Promise<Float32Array | null>
    }
  }
}

// Runs in the page. The matrix is regenerated there rather than shipped over
// CDP, which would take longer than the dispatch it is timing; the result
// goes back the other way as one POST, for the same reason.
async function gpuDistances(
  n: number,
  v: number,
  served: boolean,
  fractional: boolean,
): Promise<GpuResult> {
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('no WebGPU adapter')
  }
  const data = served
    ? new Float32Array(await (await fetch('/matrix')).arrayBuffer(), 8, n * v)
    : window.genotypes(n, v, 7, fractional)
  const rows = Array.from({ length: n }, (_, i) =>
    data.subarray(i * v, (i + 1) * v),
  )
  const t0 = performance.now()
  const result = await window.jbgpu.gpuDistanceMatrix(rows)
  const ms = performance.now() - t0
  if (!result) {
    throw new Error(
      `gpuDistanceMatrix declined ${n} x ${v} (below the work gate, no device, or does not fit)`,
    )
  }

  let maxRelErr = 0
  let checkedPairs = 0
  // Strides derived from n so the check keeps ~40 rows per axis at any N.
  const si = Math.max(1, 2 * Math.floor(n / 80) + 1)
  const sj = si + 2
  for (let i = 0; i < n; i += si) {
    for (let j = i + 1; j < n; j += sj) {
      let s = 0
      for (let k = 0; k < v; k++) {
        const d = data[i * v + k]! - data[j * v + k]!
        s += d * d
      }
      const ref = Math.sqrt(s)
      const got = result[i * n + j]!
      if (ref > 0) {
        maxRelErr = Math.max(maxRelErr, Math.abs(got - ref) / ref)
      }
      checkedPairs++
    }
  }
  await fetch('/distances', {
    method: 'POST',
    body: result.buffer as ArrayBuffer,
  })
  return {
    adapter: `${adapter.info.vendor} ${adapter.info.architecture}`,
    ms,
    maxRelErr,
    checkedPairs,
  }
}

function rowsOf(n: number, v: number, all: Float32Array) {
  return new Map(
    Array.from({ length: n }, (_, i) => [
      `sample${i}`,
      all.subarray(i * v, (i + 1) * v),
    ]),
  )
}

async function cpuCluster(n: number, v: number, all: Float32Array) {
  const data = rowsOf(n, v, all)
  const t0 = performance.now()
  await clusterMatrix({ data, statusCallback: () => {} })
  const first = performance.now() - t0
  const t1 = performance.now()
  await clusterMatrix({ data, statusCallback: () => {} })
  return { first, warm: performance.now() - t1 }
}

function differingMerges(a: ClusterResult, b: ClusterResult) {
  const flat = (r: ClusterResult) => JSON.stringify(r.tree)
  if (flat(a) === flat(b)) {
    return 0
  }
  let k = 0
  for (let i = 0; i < a.order.length; i++) {
    if (a.order[i] !== b.order[i]) {
      k++
    }
  }
  return k
}

async function main() {
  const matrix = matrixFile ? readMatrix(matrixFile) : undefined
  const n = matrix?.n ?? N
  const v = matrix?.v ?? V
  const all = matrix?.data ?? genotypes(n, v, 7, fractional)
  const bundle = buildSync({
    entryPoints: [join(treeSidebar, 'src/gpuDistanceMatrix.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'jbgpu',
    platform: 'browser',
  }).outputFiles[0]!.text

  let distances: Float32Array | undefined
  const server = http.createServer((req, res) => {
    if (req.url === '/matrix' && matrixFile) {
      res.setHeader('content-type', 'application/octet-stream')
      res.end(readFileSync(matrixFile))
    } else if (req.url === '/distances' && req.method === 'POST') {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        const buf = Buffer.concat(chunks)
        distances = new Float32Array(
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        )
        res.end('ok')
      })
    } else {
      res.setHeader('content-type', 'text/html')
      res.end('<html><body></body></html>')
    }
  })
  await new Promise<void>(resolve => {
    server.listen(0, () => {
      resolve()
    })
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: findChromeExecutable() ?? MAC_CHROME,
    protocolTimeout: 600_000,
    // `--enable-features=Vulkan` is what gets a WebGPU adapter on Linux.
    // Without it `navigator.gpu` is present on localhost and
    // `requestAdapter()` resolves null, logging "No available adapters" —
    // which reads as hardware with no WebGPU rather than as a missing flag.
    // Chrome 151, AMD gcn-4. It is a no-op on macOS.
    args: [
      ...BASE_CHROME_ARGS,
      '--enable-features=Vulkan',
      '--window-size=400,300',
    ],
  })
  let gpu: GpuResult
  try {
    const page = await browser.newPage()
    page.on('console', msg => {
      if (msg.type() === 'warn' || msg.type() === 'error') {
        console.error(`[page] ${msg.text()}`)
      }
    })
    await page.goto(`http://localhost:${port}/`)
    await page.addScriptTag({ content: bundle })
    await page.addScriptTag({
      content: `window.genotypes = ${genotypes.toString()}`,
    })
    gpu = await page.evaluate(gpuDistances, n, v, !!matrixFile, fractional)
  } finally {
    await browser.close()
    server.close()
  }
  if (!distances) {
    throw new Error('the page never posted its distance matrix back')
  }
  console.log(
    `${matrixFile ?? 'synthetic'}: N=${n} V=${v} (${(((n * n) / 2) * v) / 1e9} G pair-elements)`,
  )
  console.log(
    `gpu ${gpu.adapter}: distance matrix ${gpu.ms.toFixed(0)} ms (upload, dispatch, readback, spot check), max rel err ${gpu.maxRelErr.toExponential(1)} over ${gpu.checkedPairs} pairs`,
  )

  const t0 = performance.now()
  const fromGpu = await clusterData({ distances, onProgress: () => {} })
  const mergeMs = performance.now() - t0
  if (skipCpu) {
    console.log(
      `merge on the gpu matrix (hclust wasm): ${mergeMs.toFixed(0)} ms`,
    )
    return
  }
  const cpu = await cpuCluster(n, v, all)
  const fromRows = await clusterData({
    data: [...rowsOf(n, v, all).values()],
    onProgress: () => {},
  })
  const differ = differingMerges(fromGpu, fromRows)
  console.log(
    `merge on the gpu matrix (hclust wasm): ${mergeMs.toFixed(0)} ms, tree ${differ === 0 ? 'identical to' : `differs from (${differ} of ${n} leaves out of place vs)`} the wasm's own`,
  )
  console.log(
    `clusterMatrix (hclust wasm): first call ${cpu.first.toFixed(0)} ms, warm ${cpu.warm.toFixed(0)} ms (distance build, merge loop and newick)`,
  )
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
