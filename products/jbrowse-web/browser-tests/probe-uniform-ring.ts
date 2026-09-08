/* eslint-disable no-console */
// What the WebGPU uniform ring actually costs, and how much of it is used.
//
// `MAX_UNIFORM_SLOTS` slots are allocated eagerly per display as a GPU buffer
// AND a CPU staging array, sized by the largest uniform struct any registered
// pass declares. Two questions decide whether shrinking that struct is worth
// anything: what share of a display's GPU allocation the ring is (against the
// MSAA target, which is the other per-display allocation nothing counts), and
// how close a frame's slot usage gets to the cap.
//
// Taken by wrapping the browser's own entry points — createBuffer,
// createTexture, queue.writeBuffer, destroy — so nothing in the shipped bundle
// changes. A ring is a UNIFORM buffer whose size divides by the slot count;
// `endFrame` uploads `slotsUsed * alignedSize` bytes to it once per frame, so
// the write size divided by `size / MAX_UNIFORM_SLOTS` is the slot count that
// frame.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-uniform-ring.ts [--tracks=a,b] [--loc=ctgA:1-6000]
//       [--dpr=2] [--frames=30]
//
// Its `record:` line is the row agent-docs/measurements/uniform-ring-occupancy.json
// holds, and agent-docs/ideas/size-the-uniform-ring-to-its-measured-occupancy.md
// is what those values decided.
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { navigateToUrl, setPort, waitForDataLoaded } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const arg = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const TRACKS = (arg('tracks') ?? 'volvox_alignments,volvox_cram_alignments')
  .split(',')
  .filter(Boolean)
const LOC = arg('loc') ?? 'ctgA:1-6000'
const FRAMES = Number(arg('frames') ?? 30)
const DPR = Number(arg('dpr') ?? 1)
const CONFIG = 'test_data/volvox/config.json'
const MAX_UNIFORM_SLOTS = 2048

interface RingReport {
  rings: { size: number; aligned: number }[]
  buffers: { size: number; usage: number }[]
  textures: { w: number; h: number; sampleCount: number; format: string }[]
  slotFrames: { ring: number; frame: number; slots: number }[]
  heapBytes: number
}

async function installProbe(page: Page) {
  await page.evaluateOnNewDocument((maxSlots: number) => {
    const w = window as any
    const probe = {
      rings: [] as { size: number; aligned: number }[],
      buffers: [] as { size: number; usage: number }[],
      textures: [] as {
        w: number
        h: number
        sampleCount: number
        format: string
      }[],
      slotFrames: [] as { ring: number; frame: number; slots: number }[],
      frame: 0,
    }
    w.__ring = probe
    const tick = () => {
      probe.frame += 1
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    const ringIndex = new WeakMap<object, number>()
    const deviceProto = w.GPUDevice?.prototype
    if (deviceProto) {
      const origBuffer = deviceProto.createBuffer
      deviceProto.createBuffer = function (desc: {
        size: number
        usage: number
      }) {
        const buf = origBuffer.call(this, desc)
        const isRing =
          (desc.usage & 0x40) !== 0 &&
          desc.size >= maxSlots * 256 &&
          desc.size % maxSlots === 0
        if (isRing) {
          ringIndex.set(buf, probe.rings.length)
          probe.rings.push({
            size: desc.size,
            aligned: desc.size / maxSlots,
          })
        } else {
          probe.buffers.push({ size: desc.size, usage: desc.usage })
        }
        return buf
      }
      const origTexture = deviceProto.createTexture
      deviceProto.createTexture = function (desc: {
        size: number[] | { width: number; height: number }
        sampleCount?: number
        format: string
      }) {
        const size = Array.isArray(desc.size)
          ? { width: desc.size[0]!, height: desc.size[1] ?? 1 }
          : desc.size
        probe.textures.push({
          w: size.width,
          h: size.height,
          sampleCount: desc.sampleCount ?? 1,
          format: desc.format,
        })
        return origTexture.call(this, desc)
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
        const ring = ringIndex.get(buffer)
        if (ring !== undefined) {
          probe.slotFrames.push({
            ring,
            frame: probe.frame,
            slots: Math.ceil(
              (size ?? data.byteLength) / probe.rings[ring]!.aligned,
            ),
          })
        }
        return orig.call(this, buffer, offset, data, dataOffset, size)
      }
    }
  }, MAX_UNIFORM_SLOTS)
}

function readProbe(page: Page): Promise<RingReport> {
  return page.evaluate(() => {
    const w = window as any
    return {
      rings: w.__ring.rings.slice(),
      buffers: w.__ring.buffers.slice(),
      textures: w.__ring.textures.slice(),
      slotFrames: w.__ring.slotFrames.slice(),
      heapBytes: (performance as any).memory?.usedJSHeapSize ?? 0,
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

const mib = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MiB`

function report(label: string, r: RingReport) {
  const ringBytes = r.rings.reduce((a, b) => a + b.size, 0)
  const otherBytes = r.buffers.reduce((a, b) => a + b.size, 0)
  const texBytes = r.textures.reduce(
    (a, t) => a + t.w * t.h * 4 * t.sampleCount,
    0,
  )
  console.log(`\n${label}`)
  console.log(
    `  rings ${r.rings.length}: ${r.rings
      .map(x => `${x.size}B (slot ${x.aligned})`)
      .join(', ')}`,
  )
  console.log(
    `  ring GPU ${mib(ringBytes)} + CPU staging ${mib(ringBytes)} = ${mib(
      ringBytes * 2,
    )}`,
  )
  console.log(
    `  other GPU buffers ${r.buffers.length} totalling ${mib(otherBytes)}`,
  )
  console.log(
    `  textures ${r.textures.length} totalling ${mib(texBytes)}: ${r.textures
      .filter(t => t.w * t.h > 4096)
      .map(t => `${t.w}x${t.h}x${t.sampleCount} ${t.format}`)
      .join(', ')}`,
  )
  console.log(`  JS heap ${mib(r.heapBytes)}`)
  const peak = Math.max(0, ...r.slotFrames.map(s => s.slots))
  console.log(
    `  record: ring ${ringBytes} data ${otherBytes} msaa ${texBytes} heap ${r.heapBytes} peakSlots ${peak}`,
  )
  for (let i = 0; i < r.rings.length; i++) {
    const slots = r.slotFrames.filter(s => s.ring === i).map(s => s.slots)
    if (slots.length > 0) {
      const sorted = [...slots].sort((a, b) => a - b)
      console.log(
        `  ring ${i}: ${slots.length} frames, slots med ${
          sorted[Math.floor(sorted.length / 2)]
        } max ${Math.max(...slots)} of ${MAX_UNIFORM_SLOTS} (${(
          (Math.max(...slots) / MAX_UNIFORM_SLOTS) *
          100
        ).toFixed(1)}% of the cap)`,
      )
    }
  }
}

async function main() {
  const { port, server } = await startServerOnFreePort(3593)
  setPort(port)
  const browser = await launch({
    headless: true,
    args: [...BASE_CHROME_ARGS, '--use-gl=angle'],
    defaultViewport: { width: 1600, height: 900, deviceScaleFactor: DPR },
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
      `config=${CONFIG}&session=${spec}&sessionName=Ring%20Probe`,
    )
    await waitForDataLoaded(page, 120000)
    await new Promise(r => setTimeout(r, 3000))
    console.log(`tracks: ${TRACKS.join(', ')}  loc: ${LOC}`)
    for (const line of gpuLines.slice(0, 4)) {
      console.log(`  ${line}`)
    }
    const model = await page.evaluate(() => {
      const view = (window as any).JBrowseSession.views[0]
      return {
        width: view.width,
        dpr: window.devicePixelRatio,
        displays: view.tracks.flatMap((t: any) =>
          t.displays.map((d: any) => `${d.type}@${d.height}px`),
        ),
      }
    })
    console.log(
      `  view ${model.width}px dpr ${model.dpr}, displays: ${model.displays.join(', ')}`,
    )
    report('at load', await readProbe(page))
    await pan(page, 20, FRAMES)
    await new Promise(r => setTimeout(r, 2000))
    report('after pan', await readProbe(page))
  } finally {
    await browser.close()
    server.close()
  }
}

await main()
