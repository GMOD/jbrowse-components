import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

import type { SampleCount } from './types.ts'

// What a display's sample count decides, taken off a fake device: whether a
// multisampled colour attachment is allocated at all, and what the frame's one
// colour attachment then looks like. Both are validation failures on a real
// device rather than exceptions — an attachment that disagrees with the
// pipelines has every draw in the frame rejected and paints a blank canvas — so
// the shapes are worth pinning where they can be read.
function fakeDevice() {
  const textures: { sampleCount: number; size: unknown }[] = []
  const attachments: (GPURenderPassColorAttachment | null)[] = []
  const device = {
    limits: {
      minUniformBufferOffsetAlignment: 256,
      maxTextureDimension2D: 8192,
      maxBufferSize: 1 << 30,
    },
    lost: new Promise(() => {}),
    addEventListener: () => {},
    createBuffer: () => ({ destroy: () => {} }),
    createBindGroup: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createTexture: (desc: GPUTextureDescriptor) => {
      textures.push({ sampleCount: desc.sampleCount ?? 1, size: desc.size })
      return { createView: () => ({ view: 'msaa' }), destroy: () => {} }
    },
    createCommandEncoder: () => ({
      beginRenderPass: (desc: GPURenderPassDescriptor) => {
        attachments.push(...desc.colorAttachments)
        return { end: () => {} }
      },
      finish: () => ({}),
    }),
    pushErrorScope: () => {},
    popErrorScope: () => Promise.resolve(null),
    queue: { submit: () => {}, writeBuffer: () => {} },
  }
  return { device: device as unknown as GPUDevice, textures, attachments }
}

function fakeCanvas() {
  const context = {
    configure: () => {},
    unconfigure: () => {},
    getCurrentTexture: () => ({ createView: () => ({ view: 'canvas' }) }),
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

// No descriptors, so nothing needs a shader compiler — what is under test is
// the attachment and the texture, neither of which depends on a pass existing.
async function drawOneFrame(sampleCount: SampleCount) {
  const fake = fakeDevice()
  installGpu(fake.device)
  const hal = await WebGPUHal.create(fakeCanvas(), [], 64, sampleCount)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  hal.resize(100, 40)
  hal.beginFrame(0, 0, 0, 0)
  hal.endFrame()
  return fake
}

beforeAll(() => {
  Object.assign(globalThis, {
    GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 },
    GPUBufferUsage: { UNIFORM: 64, COPY_DST: 8 },
    GPUTextureUsage: { RENDER_ATTACHMENT: 16 },
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

test('at 4 the frame renders into a multisampled target and resolves it', async () => {
  const { device, textures, attachments } = await drawOneFrame(4)
  resetDeviceGpuCacheForTests(device)

  expect(textures).toEqual([{ sampleCount: 4, size: [100, 40] }])
  expect(attachments).toEqual([
    {
      view: { view: 'msaa' },
      resolveTarget: { view: 'canvas' },
      loadOp: 'clear',
      storeOp: 'discard',
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    },
  ])
})

test('at 1 nothing is allocated and the frame draws straight into the canvas', async () => {
  // The point of the knob: a display that does not need multisampling holds no
  // target at all, rather than a smaller one. The bytes are canvas-sized and
  // nothing in the session counts them.
  const { device, textures, attachments } = await drawOneFrame(1)
  resetDeviceGpuCacheForTests(device)

  expect(textures).toEqual([])
  expect(attachments).toEqual([
    {
      view: { view: 'canvas' },
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    },
  ])
})
