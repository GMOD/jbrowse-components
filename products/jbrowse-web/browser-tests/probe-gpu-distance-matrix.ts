import { readFileSync } from 'node:fs'
/* eslint-disable no-console */
/// <reference types="@webgpu/types" />
// The sample-by-sample Euclidean distance matrix that "Cluster by genotype"
// hands to @gmod/hclust, on a WebGPU compute kernel against the wasm build
// that computes it today. hclust's own benchmarks run at V = 20 columns, where
// the merge loop is the cost; JBrowse hands over one column per variant site
// in the window, thousands wide on a population panel, and there the distance
// build is nearly the whole run. This measures that regime on both sides with
// identical data and checks the GPU result against an f64 reference.
//
// The kernel is deliberately naive: one thread per pair, looping over V from
// global memory, no shared-memory tiling, chunked at 64 MB per upload. What it
// reports is a floor for the GPU side, not a claim.
//
// Headed Chrome, because headless has no WebGPU (see profile-zoom.ts). Real
// 1000 Genomes matrices were measured with `pnpm bench:real` in the hclust
// repo and ran at the same per-pair-element rate as the synthetic dosages
// generated here, so the size arguments are the only thing that matters:
//
//     node browser-tests/probe-gpu-distance-matrix.ts [N] [V] [--fractional]
//     node browser-tests/probe-gpu-distance-matrix.ts --matrix=<file.bin> [--skip-cpu]
//
// `--fractional` swaps the 0/1/2 dosages for the shape buildIdentityMatrix
// emits (per-bin identity in [0,1], with dropouts at 0). Integer dosages make
// the f32 partial sums exact, so the dosage mode cannot see accumulation error
// at all; the fractional one is what says whether a long V needs compensated
// summation in the kernel.
//
// N=2504 is 1000 Genomes in sample mode, 5008 in phased mode; V=3000 is a
// 100 kb window at the default MAF filter, 22000 a 1 Mb one. --matrix reads a
// real one instead: the layout `pnpm bench:real --dump=<dir>` writes in the
// hclust repo (uint32 rows, uint32 columns, float32 row-major), so both sides
// of the comparison see the identical input.
import http from 'node:http'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

import { clusterMatrix } from '../../../packages/tree-sidebar/src/clusterMatrix.ts'

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
    // matches the reference. The accumulation this is here to stress depends on
    // the magnitude of the terms and on V, not on the biology, so the
    // distribution only has to put the mass where a cohort alignment puts it:
    // near 1 (conserved), a divergent tail, and exact 0 for the dropouts that
    // are the strongest signal in the data. Row 0 is the reference, which
    // self-matches everywhere.
    const conservation = Float32Array.from(
      { length: v },
      () => 0.9 + rnd() * 0.1,
    )
    for (let i = 0; i < n; i++) {
      const divergence = i === 0 ? 0 : rnd() * 0.08
      for (let j = 0; j < v; j++) {
        // Dropout runs, not isolated bins: a haplotype stops aligning over a
        // stretch. 1.5% of bins start one, and it lasts ~20 bins.
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

const KERNEL = `
struct Params { n: u32, v: u32, pad: u32, accumulate: u32 }
@group(0) @binding(0) var<storage, read> data: array<f32>;
@group(0) @binding(1) var<storage, read_write> dist: array<f32>;
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.y;
  let j = id.x;
  if (i >= p.n || j >= p.n || j < i) { return; }
  var s = 0.0;
  let a = i * p.v;
  let b = j * p.v;
  for (var k = 0u; k < p.v; k = k + 1u) {
    let d = data[a + k] - data[b + k];
    s = s + d * d;
  }
  let o = i * p.n + j;
  if (p.accumulate == 1u) { dist[o] = dist[o] + s; } else { dist[o] = s; }
}`

interface GpuResult {
  adapter: string
  computeMs: number
  readbackMs: number
  maxRelErr: number
  checkedPairs: number
}

declare global {
  interface Window {
    genotypes: typeof genotypes
  }
}

// Runs in the page. The matrix is regenerated there rather than shipped over
// CDP, which would take longer than the dispatch it is timing; `genotypes` is
// injected as a script tag.
async function gpuDistances(
  n: number,
  v: number,
  kernel: string,
  served: boolean,
  fractional: boolean,
): Promise<GpuResult> {
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new Error('no WebGPU adapter')
  }
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize,
    },
  })
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: kernel }),
      entryPoint: 'main',
    },
  })
  const data = served
    ? new Float32Array(await (await fetch('/matrix')).arrayBuffer(), 8, n * v)
    : window.genotypes(n, v, 7, fractional)
  const chunk = Math.max(1, Math.floor((64 << 20) / 4 / n))
  const t0 = performance.now()
  const distBuf = device.createBuffer({
    size: n * n * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const readBuf = device.createBuffer({
    size: n * n * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  let first = true
  for (let v0 = 0; v0 < v; v0 += chunk) {
    const vc = Math.min(chunk, v - v0)
    const slab = new Float32Array(n * vc)
    for (let i = 0; i < n; i++) {
      slab.set(data.subarray(i * v + v0, i * v + v0 + vc), i * vc)
    }
    const dataBuf = device.createBuffer({
      size: slab.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(dataBuf, 0, slab)
    const params = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(
      params,
      0,
      new Uint32Array([n, vc, 0, first ? 0 : 1]),
    )
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dataBuf } },
        { binding: 1, resource: { buffer: distBuf } },
        { binding: 2, resource: { buffer: params } },
      ],
    })
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(n / 16), Math.ceil(n / 16))
    pass.end()
    device.queue.submit([encoder.finish()])
    await device.queue.onSubmittedWorkDone()
    dataBuf.destroy()
    params.destroy()
    first = false
  }
  const t1 = performance.now()
  const encoder = device.createCommandEncoder()
  encoder.copyBufferToBuffer(distBuf, 0, readBuf, 0, n * n * 4)
  device.queue.submit([encoder.finish()])
  await readBuf.mapAsync(GPUMapMode.READ)
  const result = new Float32Array(readBuf.getMappedRange().slice(0))
  readBuf.unmap()
  const t2 = performance.now()

  let maxRelErr = 0
  let checkedPairs = 0
  // Strides derived from n rather than fixed at 97/101, which sampled 15 pairs
  // at n=464 and 351 at n=2504 — so the check got weaker exactly as the cohort
  // got smaller. Coprime-ish odd strides targeting ~40 rows per axis keep the
  // sampled pairs from collapsing onto one diagonal.
  const si = Math.max(1, 2 * Math.floor(n / 80) + 1)
  const sj = si + 2
  for (let i = 0; i < n; i += si) {
    for (let j = i; j < n; j += sj) {
      let s = 0
      for (let k = 0; k < v; k++) {
        const d = data[i * v + k]! - data[j * v + k]!
        s += d * d
      }
      const ref = Math.sqrt(s)
      const got = Math.sqrt(result[i * n + j]!)
      if (ref > 0) {
        maxRelErr = Math.max(maxRelErr, Math.abs(got - ref) / ref)
      }
      checkedPairs++
    }
  }
  distBuf.destroy()
  readBuf.destroy()
  return {
    adapter: `${adapter.info.vendor} ${adapter.info.architecture}`,
    computeMs: t1 - t0,
    readbackMs: t2 - t0,
    maxRelErr,
    checkedPairs,
  }
}

async function cpuCluster(n: number, v: number, all: Float32Array) {
  const data = new Map(
    Array.from({ length: n }, (_, i) => [
      `sample${i}`,
      all.subarray(i * v, (i + 1) * v),
    ]),
  )
  const t0 = performance.now()
  await clusterMatrix({ data, statusCallback: () => {} })
  const first = performance.now() - t0
  const t1 = performance.now()
  await clusterMatrix({ data, statusCallback: () => {} })
  return { first, warm: performance.now() - t1 }
}

async function main() {
  const matrix = matrixFile ? readMatrix(matrixFile) : undefined
  const n = matrix?.n ?? N
  const v = matrix?.v ?? V
  const server = http.createServer((req, res) => {
    if (req.url === '/matrix' && matrixFile) {
      res.setHeader('content-type', 'application/octet-stream')
      res.end(readFileSync(matrixFile))
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
    // Chrome 151, AMD gcn-4. It is a no-op on macOS, where this was first
    // measured.
    args: [
      ...BASE_CHROME_ARGS,
      '--enable-features=Vulkan',
      '--window-size=400,300',
    ],
  })
  try {
    const page = await browser.newPage()
    await page.goto(`http://localhost:${port}/`)
    await page.addScriptTag({
      content: `window.genotypes = ${genotypes.toString()}`,
    })
    const gpu = await page.evaluate(
      gpuDistances,
      n,
      v,
      KERNEL,
      !!matrixFile,
      fractional,
    )
    console.log(
      `${matrixFile ?? 'synthetic'}: N=${n} V=${v} (${(((n * n) / 2) * v) / 1e9} G pair-elements)`,
    )
    console.log(
      `gpu ${gpu.adapter}: compute+upload ${gpu.computeMs.toFixed(0)} ms, with readback ${gpu.readbackMs.toFixed(0)} ms, max rel err ${gpu.maxRelErr.toExponential(1)} over ${gpu.checkedPairs} pairs`,
    )
  } finally {
    await browser.close()
    server.close()
  }
  if (!skipCpu) {
    const cpu = await cpuCluster(
      n,
      v,
      matrix?.data ?? genotypes(n, v, 7, fractional),
    )
    console.log(
      `clusterMatrix (hclust wasm): first call ${cpu.first.toFixed(0)} ms, warm ${cpu.warm.toFixed(0)} ms (distance build, merge loop and newick)`,
    )
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
