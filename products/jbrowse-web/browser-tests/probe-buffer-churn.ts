/* eslint-disable no-console */
// How much GPU buffer allocation a pan with alignments open actually does.
//
// `uploadBuffer` destroys and recreates one buffer per `(regionKey, passId)`
// per upload, and GPU_RENDERING.md §"What this architecture deliberately does
// not have" files buffer pooling as the one unmeasured entry on that list: the
// number that decides it is the allocation churn on a pan with alignments
// open. This is that number.
//
// The count is taken by wrapping the browser's own buffer entry points in the
// page — `GPUDevice.createBuffer` / `GPUBuffer.destroy` on the WebGPU rung,
// `createBuffer` / `bufferData` / `deleteBuffer` on WebGL2 — so nothing in the
// shipped bundle changes and every allocation is seen, the uniform ring and
// UBO included. Draw calls are counted per animation frame at the same time,
// which is the draw-call-batching number the same list wants.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-buffer-churn.ts [--backend=webgl|webgpu] \
//       [--frames=60] [--px=40] [--tracks=a,b]
//
// Three phases per run, each reported separately: the pan (leaves the loaded
// blocks, so new regions fetch and upload while pruned ones release), the
// settle after it (the debounced refetch landing), and the pan back over the
// ground just left (pruned blocks re-fetched, so the release-then-recreate
// pattern a pool would serve is exercised twice).
//
// TRAPS
//
//  - Headless Chrome picks SwiftShader unless told otherwise; `--use-gl=angle`
//    is what puts a real GPU under the WebGL2 rung and lets the ladder land on
//    WebGPU at all (probe-hic-buffered-vertex-cost.ts records the same).
//  - `createBuffer`'s wall time on WebGPU is the JS call, not the allocation:
//    the device allocates asynchronously. The GL rung's `bufferData` is the
//    honest synchronous cost; read the WebGPU time column as an upper bound on
//    the JS-side overhead only.
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { navigateToUrl, setPort, waitForDataLoaded } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'
import { snapshotConfig } from './snapshot.ts'

import type { Page } from 'puppeteer'

const arg = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const BACKEND = arg('backend') ?? ''
const FRAMES = Number(arg('frames') ?? 60)
const PX_PER_FRAME = Number(arg('px') ?? 40)
const TRACKS = (arg('tracks') ?? 'volvox_alignments,volvox_cram_alignments')
  .split(',')
  .filter(Boolean)
const CONFIG = 'test_data/volvox/config.json'
const LOC = 'ctgA:1-6000'

interface BufferEvent {
  t: number
  kind:
    | 'gpuCreate'
    | 'gpuDestroy'
    | 'gpuWrite'
    | 'glCreate'
    | 'glData'
    | 'glSubData'
    | 'glDelete'
  bytes: number
  usage: number
  ms: number
}

interface DrawEvent {
  frame: number
  instances: number
}

interface ChurnWindow {
  buffers: BufferEvent[]
  draws: DrawEvent[]
  glContexts: number
  frames: number
  wallMs: number
}

async function installProbe(page: Page) {
  await page.evaluateOnNewDocument(() => {
    const w = window as any
    const probe = {
      buffers: [] as BufferEvent[],
      draws: [] as DrawEvent[],
      frame: 0,
      startFrame: 0,
      startT: 0,
      glContexts: new WeakSet<object>(),
      glContextCount: 0,
    }
    w.__churn = probe
    const tick = () => {
      probe.frame += 1
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    const gpuSizes = new WeakMap<object, number>()
    const deviceProto = w.GPUDevice?.prototype
    if (deviceProto) {
      const orig = deviceProto.createBuffer
      deviceProto.createBuffer = function (desc: {
        size: number
        usage: number
      }) {
        const t0 = performance.now()
        const buf = orig.call(this, desc)
        probe.buffers.push({
          t: t0,
          kind: 'gpuCreate',
          bytes: desc.size,
          usage: desc.usage,
          ms: performance.now() - t0,
        })
        gpuSizes.set(buf, desc.size)
        return buf
      }
    }
    const bufferProto = w.GPUBuffer?.prototype
    if (bufferProto) {
      const orig = bufferProto.destroy
      bufferProto.destroy = function () {
        probe.buffers.push({
          t: performance.now(),
          kind: 'gpuDestroy',
          bytes: gpuSizes.get(this) ?? 0,
          usage: 0,
          ms: 0,
        })
        return orig.call(this)
      }
    }
    const queueProto = w.GPUQueue?.prototype
    if (queueProto) {
      const orig = queueProto.writeBuffer
      queueProto.writeBuffer = function (
        buffer: object,
        offset: number,
        data: ArrayBuffer | ArrayBufferView,
        dataOffset?: number,
        size?: number,
      ) {
        probe.buffers.push({
          t: performance.now(),
          kind: 'gpuWrite',
          bytes: size ?? data.byteLength,
          usage: 0,
          ms: 0,
        })
        return orig.call(this, buffer, offset, data, dataOffset, size)
      }
    }
    const passProto = w.GPURenderPassEncoder?.prototype
    if (passProto) {
      const orig = passProto.draw
      passProto.draw = function (
        vertexCount: number,
        instanceCount = 1,
        ...rest: unknown[]
      ) {
        probe.draws.push({ frame: probe.frame, instances: instanceCount })
        return orig.call(this, vertexCount, instanceCount, ...rest)
      }
    }

    const glProto = w.WebGL2RenderingContext?.prototype
    if (glProto) {
      const noteContext = (gl: object) => {
        if (!probe.glContexts.has(gl)) {
          probe.glContexts.add(gl)
          probe.glContextCount += 1
        }
      }
      const origCreate = glProto.createBuffer
      glProto.createBuffer = function () {
        noteContext(this)
        probe.buffers.push({
          t: performance.now(),
          kind: 'glCreate',
          bytes: 0,
          usage: 0,
          ms: 0,
        })
        return origCreate.call(this)
      }
      const origData = glProto.bufferData
      glProto.bufferData = function (
        target: number,
        data: number | ArrayBuffer | ArrayBufferView,
        usage: number,
        ...rest: unknown[]
      ) {
        const t0 = performance.now()
        const r = origData.call(this, target, data, usage, ...rest)
        probe.buffers.push({
          t: t0,
          kind: 'glData',
          bytes: typeof data === 'number' ? data : data.byteLength,
          usage: target,
          ms: performance.now() - t0,
        })
        return r
      }
      const origSub = glProto.bufferSubData
      glProto.bufferSubData = function (
        target: number,
        offset: number,
        data: ArrayBuffer | ArrayBufferView,
        ...rest: unknown[]
      ) {
        probe.buffers.push({
          t: performance.now(),
          kind: 'glSubData',
          bytes: data.byteLength,
          usage: target,
          ms: 0,
        })
        return origSub.call(this, target, offset, data, ...rest)
      }
      const origDelete = glProto.deleteBuffer
      glProto.deleteBuffer = function (buf: object) {
        probe.buffers.push({
          t: performance.now(),
          kind: 'glDelete',
          bytes: 0,
          usage: 0,
          ms: 0,
        })
        return origDelete.call(this, buf)
      }
      const origDraw = glProto.drawArraysInstanced
      glProto.drawArraysInstanced = function (
        mode: number,
        first: number,
        count: number,
        instanceCount: number,
      ) {
        probe.draws.push({ frame: probe.frame, instances: instanceCount })
        return origDraw.call(this, mode, first, count, instanceCount)
      }
    }
  })
}

function resetProbe(page: Page) {
  return page.evaluate(() => {
    const w = window as any
    w.__churn.buffers.length = 0
    w.__churn.draws.length = 0
    w.__churn.startFrame = w.__churn.frame
    w.__churn.startT = performance.now()
  })
}

function readProbe(page: Page): Promise<ChurnWindow> {
  return page.evaluate(() => {
    const w = window as any
    return {
      buffers: w.__churn.buffers.slice(),
      draws: w.__churn.draws.slice(),
      glContexts: w.__churn.glContextCount,
      frames: w.__churn.frame - w.__churn.startFrame,
      wallMs: performance.now() - w.__churn.startT,
    }
  })
}

async function pan(page: Page, px: number, frames: number) {
  await page.evaluate(
    async (px, frames) => {
      const view = (window as any).JBrowseSession.views[0]
      for (let i = 0; i < frames; i++) {
        view.horizontalScroll(px)
        await new Promise(r => requestAnimationFrame(r))
      }
    },
    px,
    frames,
  )
}

// The fetch autorun debounces, so a quiet display right after the gesture
// proves nothing; wait until every display has been not-loading for a full
// second past the debounce.
async function settle(page: Page, timeout = 60000) {
  const t0 = Date.now()
  let quietSince = Date.now()
  for (;;) {
    const loading = await page.evaluate(() => {
      const view = (window as any).JBrowseSession.views[0]
      return view.tracks.some((t: any) =>
        t.displays.some(
          (d: any) => d.isLoading || d.displayPhase === 'loading',
        ),
      )
    })
    if (loading) {
      quietSince = Date.now()
    } else if (Date.now() - quietSince > 1500) {
      return
    }
    if (Date.now() - t0 > timeout) {
      throw new Error('displays did not settle')
    }
    await new Promise(r => setTimeout(r, 100))
  }
}

function median(xs: number[]) {
  if (xs.length === 0) {
    return Number.NaN
  }
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

function sizeBucket(bytes: number) {
  return bytes < 4096
    ? '<4KB'
    : bytes < 65536
      ? '<64KB'
      : bytes < 1048576
        ? '<1MB'
        : '>=1MB'
}

function summarize(label: string, win: ChurnWindow) {
  const creates = win.buffers.filter(
    b => b.kind === 'gpuCreate' || b.kind === 'glData',
  )
  const destroys = win.buffers.filter(
    b => b.kind === 'gpuDestroy' || b.kind === 'glDelete',
  )
  const writes = win.buffers.filter(
    b => b.kind === 'gpuWrite' || b.kind === 'glSubData',
  )
  const bytes = creates.reduce((a, b) => a + b.bytes, 0)
  const ms = creates.reduce((a, b) => a + b.ms, 0)
  const buckets = new Map<string, number>()
  for (const c of creates) {
    const k = sizeBucket(c.bytes)
    buckets.set(k, (buckets.get(k) ?? 0) + 1)
  }
  const drawsPerFrame = new Map<number, number>()
  for (const d of win.draws) {
    drawsPerFrame.set(d.frame, (drawsPerFrame.get(d.frame) ?? 0) + 1)
  }
  const perFrame = [...drawsPerFrame.values()]
  console.log(
    [
      label.padEnd(12),
      `wall ${win.wallMs.toFixed(0)}ms`.padStart(12),
      `rAF ${win.frames}`.padStart(9),
      `allocs ${creates.length}`.padStart(11),
      `${(bytes / 1024).toFixed(0)}KB`.padStart(9),
      `alloc-ms ${ms.toFixed(2)}`.padStart(15),
      `max ${Math.max(0, ...creates.map(c => c.ms)).toFixed(2)}`.padStart(9),
      `frees ${destroys.length}`.padStart(10),
      `uniformWrites ${writes.length}`.padStart(19),
      `drawFrames ${perFrame.length}`.padStart(15),
      `draws/frame med ${median(perFrame)} max ${Math.max(0, ...perFrame)}`.padStart(
        30,
      ),
      `sizes ${[...buckets.entries()].map(([k, v]) => `${k}:${v}`).join(' ')}`,
    ].join('  '),
  )
}

async function main() {
  const { port, server } = await startServerOnFreePort(3591)
  setPort(port)
  snapshotConfig.backend = BACKEND
  const browser = await launch({
    headless: true,
    args: [...BASE_CHROME_ARGS, '--use-gl=angle'],
    defaultViewport: { width: 1600, height: 900 },
  })
  const page = await browser.newPage()
  const gpuLines: string[] = []
  page.on('console', m => {
    const t = m.text()
    if (t.includes('[GPU]') || t.includes('Hal')) {
      gpuLines.push(t)
    }
  })
  try {
    await installProbe(page)
    const spec = encodeSessionSpec({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: LOC,
          tracks: TRACKS,
        },
      ],
    })
    await navigateToUrl(
      page,
      `config=${CONFIG}&session=${spec}&sessionName=Churn%20Probe`,
    )
    await waitForDataLoaded(page, 120000)
    await settle(page)
    const load = await readProbe(page)
    console.log(
      `backend: ${BACKEND || 'default ladder'}  tracks: ${TRACKS.join(', ')}  ` +
        `loc: ${LOC}  pan: ${FRAMES} frames x ${PX_PER_FRAME}px  ` +
        `webgl2 contexts seen: ${load.glContexts}`,
    )
    for (const line of gpuLines.slice(0, 3)) {
      console.log(`  ${line}`)
    }
    const model = await page.evaluate(() => {
      const view = (window as any).JBrowseSession.views[0]
      return {
        width: view.width,
        bpPerPx: view.bpPerPx,
        blocks: view.staticBlocks.contentBlocks.length,
        displays: view.tracks.flatMap((t: any) =>
          t.displays.map((d: any) => d.type),
        ),
      }
    })
    console.log(
      `  view ${model.width}px @ ${model.bpPerPx.toFixed(2)} bp/px, ` +
        `${model.blocks} static blocks, displays: ${model.displays.join(', ')}`,
    )
    summarize('load', load)

    await resetProbe(page)
    await pan(page, PX_PER_FRAME, FRAMES)
    const panWin = await readProbe(page)
    summarize('pan', panWin)

    await resetProbe(page)
    await settle(page)
    summarize('settle', await readProbe(page))

    await resetProbe(page)
    await pan(page, -PX_PER_FRAME, FRAMES)
    await settle(page)
    summarize('pan-back', await readProbe(page))

    await resetProbe(page)
    await pan(page, 1, FRAMES)
    summarize('pan-1px', await readProbe(page))
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
