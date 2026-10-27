import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import { pointMark } from '../marks/pointMark.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

// Whether a draw happens is what this asks, so it counts draws on a recording
// device; webgpuHalDawn.test.ts holds every pass to Dawn's validation.

function recordingDevice() {
  let draws = 0
  const pass = {
    setPipeline: () => {},
    setBindGroup: () => {},
    setVertexBuffer: () => {},
    setScissorRect: () => {},
    setViewport: () => {},
    draw: () => {
      draws++
    },
    end: () => {},
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
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createBindGroup: () => ({}),
    createShaderModule: () => ({
      getCompilationInfo: () => Promise.resolve({ messages: [] }),
    }),
    createRenderPipelineAsync: () => Promise.resolve({}),
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
  return { device: device as unknown as GPUDevice, draws: () => draws }
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

afterEach(() => {
  resetGpuDeviceForTests()
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: undefined,
  })
})

test('a pass sampling two textures draws once both have arrived', async () => {
  const fake = recordingDevice()
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {
      requestAdapter: () =>
        Promise.resolve({
          info: {},
          limits: { maxBufferSize: 1 << 30 },
          requestDevice: () => Promise.resolve(fake.device),
        }),
      getPreferredCanvasFormat: () => 'bgra8unorm',
    },
  })
  const { pass } = pointMark
  const hal = await WebGPUHal.create(fakeCanvas(), [pass], 1)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  const frame = () => {
    hal.beginFrame(0, 0, 0)
    hal.writeUniforms(new ArrayBuffer(pass.uniformByteSize))
    hal.drawPass(pass.id, 0)
    hal.endFrame()
  }
  hal.resize(100, 40)
  hal.uploadBuffer(0, pass.id, new ArrayBuffer(pass.instanceStride), 1)
  expect(pass.textures?.map(t => t.name)).toEqual(['colorRamp', 'rowTable'])

  hal.uploadTexture(pass.id, new Uint8Array(256 * 4), 256, 1, 'colorRamp')
  frame()
  expect(fake.draws()).toBe(0)

  hal.uploadTexture(pass.id, new Uint8Array(2 * 4), 1, 2, 'rowTable')
  frame()
  expect(fake.draws()).toBe(1)
  hal.dispose()
  resetDeviceGpuCacheForTests(fake.device)
})
