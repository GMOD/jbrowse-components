// What a display's MSAA target costs once the driver has it, rather than what
// the descriptor asks for: allocates `WebGPUHal`'s attachment through Dawn,
// drives it the way a frame does (clear, discard, resolve), and reads the
// process's DRM memory from /proc/self/fdinfo at each step. Linux only.
//
//   node scripts/gpu-pixels/probe-msaa-residency.ts [--adapter=AMD]
//     [--power=high-performance] [--width=2532] [--height=8180] [--frames=10]
//     [--samples=1]
//
// `--samples=1` is the control: the resolve target alone, as a display at one
// sample renders straight into its canvas texture.
//
// The default size is one 1266x4090 CSS px track at dpr 2, which the
// descriptor prices at 316 MiB.
import { readFileSync, readdirSync, readlinkSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { create, globals } from 'webgpu'

const { values } = parseArgs({
  options: {
    adapter: { type: 'string' },
    power: { type: 'string', default: 'low-power' },
    width: { type: 'string', default: '2532' },
    height: { type: 'string', default: '8180' },
    frames: { type: 'string', default: '10' },
    samples: { type: 'string', default: '4' },
  },
})
const width = Number(values.width)
const height = Number(values.height)
const multisampled = values.samples !== '1'
const MiB = 1024 * 1024

// KiB per key, summed over this process's DRM clients, each counted once.
function drmMemory() {
  const totals = new Map<string, number>()
  const seen = new Set<string>()
  for (const fd of readdirSync('/proc/self/fd')) {
    const target = (() => {
      try {
        return readlinkSync(`/proc/self/fd/${fd}`)
      } catch {
        return ''
      }
    })()
    if (target.startsWith('/dev/dri/')) {
      const info = readFileSync(`/proc/self/fdinfo/${fd}`, 'utf8')
      const client = /^drm-client-id:\s*(\d+)/m.exec(info)?.[1]
      const driver = /^drm-driver:\s*(\S+)/m.exec(info)?.[1]
      if (client !== undefined && !seen.has(`${driver}:${client}`)) {
        seen.add(`${driver}:${client}`)
        for (const m of info.matchAll(
          /^(drm-(?:total|resident|memory)-\S+):\s*(\d+)\s*(\w*)/gm,
        )) {
          const unit = m[3] === 'MiB' ? 1024 : m[3] === 'KiB' ? 1 : 1 / 1024
          const key = `${driver} ${m[1]}`
          totals.set(key, (totals.get(key) ?? 0) + Number(m[2]) * unit)
        }
      }
    }
  }
  return totals
}

function report(step: string, base: Map<string, number>) {
  const now = drmMemory()
  const deltas = [...now]
    .map(([k, v]) => [k, (v - (base.get(k) ?? 0)) / 1024] as const)
    .filter(([, d]) => Math.abs(d) >= 0.5)
    .map(([k, d]) => `${k} ${d >= 0 ? '+' : ''}${d.toFixed(1)}`)
  console.log(`  ${step.padEnd(34)} ${deltas.join(', ') || '(no change)'}`)
}

Object.assign(globalThis, globals)
const gpu = create(
  values.adapter ? ['backend=vulkan', `adapter=${values.adapter}`] : [],
)
const adapter = await gpu.requestAdapter({
  powerPreference: values.power as GPUPowerPreference,
})
if (!adapter) {
  throw new Error('Dawn found no adapter')
}
const device = await adapter.requestDevice({
  requiredLimits: {
    maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
  },
})
device.addEventListener('uncapturederror', e => {
  console.error('GPU error:', e.error.message)
})
const format = 'bgra8unorm'
const asked = (width * height * 4 * 4) / MiB
console.log(
  `adapter: ${adapter.info.description || adapter.info.vendor}; ${width}x${height} ${format}, 4x MSAA descriptor ${asked.toFixed(1)} MiB, its resolve target ${(asked / 4).toFixed(1)} MiB`,
)

await device.queue.onSubmittedWorkDone()
const base = drmMemory()
console.log('  baseline (MiB of DRM memory, delta from here)')

const resolve = device.createTexture({
  size: [width, height],
  format,
  usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
})
const msaa = multisampled
  ? device.createTexture({
      size: [width, height],
      format,
      sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  : undefined
report(multisampled ? 'both textures created' : 'resolve target created', base)

for (let i = 0; i < Number(values.frames); i++) {
  const encoder = device.createCommandEncoder()
  encoder
    .beginRenderPass({
      colorAttachments: [
        msaa
          ? {
              view: msaa.createView(),
              resolveTarget: resolve.createView(),
              loadOp: 'clear',
              storeOp: 'discard',
              clearValue: { r: 1, g: 1, b: 1, a: 1 },
            }
          : {
              view: resolve.createView(),
              loadOp: 'clear',
              storeOp: 'store',
              clearValue: { r: 1, g: 1, b: 1, a: 1 },
            },
      ],
    })
    .end()
  device.queue.submit([encoder.finish()])
  await device.queue.onSubmittedWorkDone()
  if (i === 0) {
    report('after one frame', base)
  }
}
report(`after ${values.frames} frames`, base)

if (msaa) {
  msaa.destroy()
  await device.queue.onSubmittedWorkDone()
  report('MSAA target destroyed', base)
}
resolve.destroy()
await device.queue.onSubmittedWorkDone()
report('resolve target destroyed', base)
device.destroy()
void gpu
