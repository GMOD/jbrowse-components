import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { makeComputePipelineCache } from '../computePipeline.ts'
import { getGpuDevice } from '../gpuDevice.ts'
import { slangPass } from '../slangPass.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { ShaderModule } from '../slangPass.ts'

// Every shader in the tree, built into a pipeline, bound and drawn by the
// WebGPU HAL on Dawn, the WebGPU implementation inside Chrome. Its null
// backend validates everything a browser does and needs no GPU, so a vertex
// layout, blend state or bind group WebGPU would refuse fails here rather than
// as a `[GPU] UNCAPTURED` line on a page that quietly fell back to WebGL2.
// webgpuHalBindingVisibility.test.ts asks narrower questions of a recording
// device; this one asks Dawn.

const root = path.resolve(__dirname, '../../../..')

type GeneratedModule = ShaderModule & { COMPUTE_ENTRY_POINT?: string }

interface Dawn {
  create: (options: string[]) => GPU
  globals: Record<string, unknown>
}

// The addon directly, since the package's ESM entry needs `import.meta`.
function loadDawn() {
  const dir = path.dirname(require.resolve('webgpu/package.json'))
  const arch = process.platform === 'darwin' ? 'universal' : process.arch
  return require(
    path.join(dir, 'dist', `${process.platform}-${arch}`, 'dawn.node'),
  ) as Dawn
}

const shaders = execFileSync('git', ['ls-files', '*.slang'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter(file =>
    existsSync(path.join(root, file.replace(/\.slang$/, '.wgsl.generated.ts'))),
  )

// dawn.node does not keep a device's parents alive, and a collected GPU or
// adapter under a live device aborts the process, so both stay reachable from
// here until the device is destroyed.
let gpu: GPU
let device: GPUDevice

function canvasOn(format: GPUTextureFormat) {
  let configured: GPUCanvasConfiguration | undefined
  const canvas = {
    width: 0,
    height: 0,
    style: {} as CSSStyleDeclaration,
    getContext: (kind: string) =>
      kind === 'webgpu'
        ? {
            configure: (config: GPUCanvasConfiguration) => {
              configured = config
            },
            unconfigure: () => {},
            getCurrentTexture: () =>
              configured!.device.createTexture({
                size: [Math.max(1, canvas.width), Math.max(1, canvas.height)],
                format,
                usage: configured!.usage ?? GPUTextureUsage.RENDER_ATTACHMENT,
              }),
          }
        : null,
  }
  return canvas as unknown as HTMLCanvasElement
}

async function validationErrorsOf(work: () => Promise<void>) {
  device.pushErrorScope('validation')
  const thrown = await work().then(
    () => undefined,
    (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  )
  await device.queue.onSubmittedWorkDone()
  const error = await device.popErrorScope()
  if (thrown) {
    throw thrown
  }
  if (error) {
    throw new Error(error.message)
  }
}

beforeAll(async () => {
  const dawn = loadDawn()
  Object.assign(globalThis, dawn.globals)
  gpu = dawn.create(['backend=null'])
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: gpu })
  const got = await getGpuDevice()
  if (!got) {
    throw new Error(`Dawn's null backend gave the HAL no device`)
  }
  device = got
})

afterAll(() => {
  device.destroy()
})

test('finds the tree’s shaders', () => {
  expect(shaders.length).toBeGreaterThan(40)
})

test.each(shaders)('%s', async rel => {
  const mod: Partial<GeneratedModule> = await import(
    path.join(root, rel.replace(/\.slang$/, '.generated.ts'))
  )
  const { SOURCE, BINDINGS, COMPUTE_ENTRY_POINT } = mod
  if (!SOURCE || !BINDINGS) {
    throw new Error(`${rel} generated no SOURCE or no BINDINGS`)
  }
  if (COMPUTE_ENTRY_POINT) {
    await validationErrorsOf(async () => {
      await makeComputePipelineCache(
        SOURCE,
        COMPUTE_ENTRY_POINT,
        BINDINGS,
      )(device)
    })
    return
  }
  const { VERTEX_ATTRIBUTES, INSTANCE_STRIDE_BYTES, UNIFORMS_SIZE_BYTES } = mod
  if (
    !VERTEX_ATTRIBUTES ||
    INSTANCE_STRIDE_BYTES === undefined ||
    UNIFORMS_SIZE_BYTES === undefined
  ) {
    throw new Error(`${rel} has a binding table and no vertex input layout`)
  }
  const desc = slangPass({
    id: rel,
    mod: {
      ...mod,
      SOURCE,
      BINDINGS,
      VERTEX_ATTRIBUTES,
      INSTANCE_STRIDE_BYTES,
      UNIFORMS_SIZE_BYTES,
      VERTS_PER_INSTANCE: mod.VERTS_PER_INSTANCE ?? 6,
    },
  })
  for (const sampleCount of [1, 4] as const) {
    await validationErrorsOf(async () => {
      const hal = await WebGPUHal.create(
        canvasOn(gpu.getPreferredCanvasFormat()),
        [desc],
        sampleCount,
      )
      if (!hal) {
        throw new Error('Dawn failed to build a HAL')
      }
      hal.resize(100, 40)
      for (const { name } of desc.textures ?? []) {
        hal.uploadTexture(rel, new Uint8Array(256 * 4), 256, 1, name)
      }
      hal.uploadBuffer(0, rel, new ArrayBuffer(desc.instanceStride), 1)
      hal.beginFrame(0, 0, 0)
      hal.writeUniforms(new ArrayBuffer(desc.uniformByteSize))
      hal.drawPass(rel, 0)
      hal.endFrame()
      hal.dispose()
    })
  }
})
