import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { makeComputePipelineCache } from '../computePipeline.ts'
import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import { slangPass } from '../slangPass.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { ShaderModule } from '../slangPass.ts'
import type { ShaderBinding, ShaderStage } from './types.ts'

// Every binding a stage reads is visible to that stage in the layout the
// WebGPU HAL builds for the pass, for every shader in the tree, and the draw
// binds a group built against that same layout. WebGPU refuses a pipeline that
// breaks the first, and the ladder then draws the display on WebGL2 with
// nothing on screen to say so. `stages` is the generator's statement of what
// each stage reads, held to the emitted WGSL by `assertStageReadsMatchWgsl`;
// this holds the HAL to `stages`.

const STAGE_BIT: Record<ShaderStage, number> = {
  vertex: 1,
  fragment: 2,
  compute: 4,
}

const root = path.resolve(__dirname, '../../../..')

type GeneratedModule = ShaderModule & { COMPUTE_ENTRY_POINT?: string }

const shaders = execFileSync('git', ['ls-files', '*.slang'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter(file =>
    existsSync(path.join(root, file.replace(/\.slang$/, '.wgsl.generated.ts'))),
  )

// A layout, a pipeline layout or a bind group is handed back as a bare token,
// and the descriptor it was made from is kept against it, so what the HAL built
// is read back rather than inferred.
function keep<D>(into: Map<unknown, D>) {
  return (desc: D) => {
    const token = {}
    into.set(token, desc)
    return token
  }
}

function recordingDevice() {
  const layouts = new Map<unknown, GPUBindGroupLayoutDescriptor>()
  const pipelineLayouts = new Map<unknown, GPUPipelineLayoutDescriptor>()
  const groups = new Map<unknown, GPUBindGroupDescriptor>()
  const pipelines: { layout: unknown }[] = []
  const bound: unknown[] = []
  const pass = {
    setPipeline: () => {},
    setBindGroup: (_index: number, group: unknown) => bound.push(group),
    setVertexBuffer: () => {},
    setScissorRect: () => {},
    setViewport: () => {},
    draw: () => {},
    end: () => {},
  }
  const built = (desc: { layout: unknown }) => {
    pipelines.push(desc)
    return Promise.resolve({})
  }
  const device = {
    limits: {
      minUniformBufferOffsetAlignment: 256,
      maxTextureDimension2D: 8192,
      maxBufferSize: 1 << 30,
    },
    lost: new Promise(() => {}),
    addEventListener: () => {},
    createBuffer: () => ({ destroy: () => {} }),
    createBindGroupLayout: keep(layouts),
    createPipelineLayout: keep(pipelineLayouts),
    createBindGroup: keep(groups),
    createShaderModule: () => ({
      getCompilationInfo: () => Promise.resolve({ messages: [] }),
    }),
    createRenderPipelineAsync: built,
    createComputePipelineAsync: built,
    createTexture: () => ({ createView: () => ({}), destroy: () => {} }),
    createSampler: () => ({}),
    createCommandEncoder: () => ({
      beginRenderPass: () => pass,
      finish: () => ({}),
    }),
    pushErrorScope: () => {},
    popErrorScope: () => Promise.resolve(null),
    queue: { submit: () => {}, writeBuffer: () => {}, writeTexture: () => {} },
  }
  const entriesOf = (layout: unknown) => [
    ...(layouts.get(layout)?.entries ?? []),
  ]
  return {
    device: device as unknown as GPUDevice,
    pipelineEntries: () =>
      entriesOf(pipelineLayouts.get(pipelines[0]?.layout)?.bindGroupLayouts[0]),
    boundEntries: () => entriesOf(groups.get(bound[0])?.layout),
  }
}

function fakeCanvas() {
  const context = {
    configure: () => {},
    unconfigure: () => {},
    getCurrentTexture: () => ({ createView: () => ({}) }),
  }
  const canvas = {
    width: 0,
    height: 0,
    style: {} as CSSStyleDeclaration,
    getContext: (kind: string) => (kind === 'webgpu' ? context : null),
  }
  return canvas as unknown as HTMLCanvasElement
}

function installGpu(device: GPUDevice) {
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {
      requestAdapter: () =>
        Promise.resolve({
          info: {},
          limits: { maxBufferSize: 1 << 30 },
          requestDevice: () => Promise.resolve(device),
        }),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    },
  })
}

const STAGES: ShaderStage[] = ['vertex', 'fragment', 'compute']

const stageNames = (mask: number) =>
  STAGES.filter(s => mask & STAGE_BIT[s]).join(' and ') || 'no stage'

// One line per stage a binding is hidden from, so a failure reads as the
// validation error WebGPU would have raised.
function hidden(
  bindings: readonly ShaderBinding[],
  entries: GPUBindGroupLayoutEntry[],
) {
  return bindings.flatMap(b => {
    const entry = entries.find(e => e.binding === b.index)
    return b.stages
      .filter(s => !((entry?.visibility ?? 0) & STAGE_BIT[s]))
      .map(
        s =>
          `binding ${b.index} ('${b.name}', a ${b.kind}) is read by the ${s} ` +
          `stage, and the layout shows it to ${stageNames(entry?.visibility ?? 0)}`,
      )
  })
}

beforeAll(() => {
  Object.assign(globalThis, {
    GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
    GPUBufferUsage: { UNIFORM: 64, COPY_DST: 8, VERTEX: 32 },
    GPUTextureUsage: { TEXTURE_BINDING: 4, COPY_DST: 2, RENDER_ATTACHMENT: 16 },
  })
})

afterAll(() => {
  for (const k of ['GPUShaderStage', 'GPUBufferUsage', 'GPUTextureUsage']) {
    Reflect.deleteProperty(globalThis, k)
  }
})

beforeEach(() => {
  resetGpuDeviceForTests()
})

afterEach(() => {
  resetGpuDeviceForTests()
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: undefined,
  })
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
  const fake = recordingDevice()
  if (COMPUTE_ENTRY_POINT) {
    await makeComputePipelineCache(
      SOURCE,
      COMPUTE_ENTRY_POINT,
      BINDINGS,
    )(fake.device)
    expect(hidden(BINDINGS, fake.pipelineEntries())).toEqual([])
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
    },
    verticesPerInstance: 6,
  })
  installGpu(fake.device)
  const hal = await WebGPUHal.create(fakeCanvas(), [desc], 1)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  hal.resize(100, 40)
  if (desc.textures) {
    hal.uploadTexture(rel, new Uint8Array(256 * 4), 256, 1)
  }
  hal.uploadBuffer(0, rel, new ArrayBuffer(desc.instanceStride), 1)
  hal.beginFrame(0, 0, 0)
  hal.writeUniforms(new ArrayBuffer(desc.uniformByteSize))
  hal.drawPass(rel, 0)
  hal.endFrame()

  expect(hidden(BINDINGS, fake.pipelineEntries())).toEqual([])
  expect(fake.boundEntries()).toEqual(fake.pipelineEntries())
  hal.dispose()
  resetDeviceGpuCacheForTests(fake.device)
})
