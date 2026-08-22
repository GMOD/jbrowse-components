import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

// A `GPUCanvasContext` as Firefox behaves: `getCurrentTexture` throws
// `InvalidStateError: ... Canvas not configured` whenever no configuration is
// live, `unconfigure()` drops it, `configure()` restores it. Measured in Firefox
// Nightly — no other operation (device destroy, detaching the element, resizing
// it, hiding the tab) drops one, and reconfiguring recovers fully.
function fakeCanvas() {
  const state = { configured: false, configures: 0, unconfigures: 0 }
  const context = {
    configure: () => {
      state.configured = true
      state.configures++
    },
    unconfigure: () => {
      state.configured = false
      state.unconfigures++
    },
    getCurrentTexture: () => {
      if (!state.configured) {
        throw new DOMException(
          'GPUCanvasContext.getCurrentTexture: Canvas not configured',
          'InvalidStateError',
        )
      }
      return { createView: () => ({ view: 'canvas' }) }
    },
  }
  // A plain object rather than a jsdom <canvas>: the HAL reads width/height and
  // hands the element to `getContext`, and jsdom implements no GPU contexts.
  const canvas = {
    width: 0,
    height: 0,
    style: {} as CSSStyleDeclaration,
    getContext: (kind: string) => (kind === 'webgpu' ? context : null),
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, context, state }
}

function fakeDevice() {
  const frames = { encoders: 0, passes: 0, submits: 0 }
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
    createTexture: () => ({ createView: () => ({}), destroy: () => {} }),
    createCommandEncoder: () => {
      frames.encoders++
      return {
        beginRenderPass: () => {
          frames.passes++
          return { end: () => {} }
        },
        finish: () => ({}),
      }
    },
    pushErrorScope: () => {},
    popErrorScope: () => Promise.resolve(null),
    queue: {
      submit: () => {
        frames.submits++
      },
      writeBuffer: () => {},
    },
  }
  return { device: device as unknown as GPUDevice, frames }
}

// `WebGPUHal.create` resolves its device through the module-level `getGpuDevice`,
// so the fake stack is installed on `navigator`.
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

// No descriptors, so `resolvePipelines` needs no shader compiler. Nothing here
// draws a pass; what these tests are about is the frame's swap-chain acquisition.
async function makeHal(canvas: HTMLCanvasElement, device: GPUDevice) {
  installGpu(device)
  const hal = await WebGPUHal.create(canvas, [], 64, 4)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  hal.resize(100, 40)
  return hal
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

test('disposing a HAL releases the swap chain it holds', async () => {
  const { canvas, state } = fakeCanvas()
  const { device } = fakeDevice()
  const hal = await makeHal(canvas, device)

  expect(state.configured).toBe(true)
  hal.dispose()
  expect(state.unconfigures).toBe(1)
  expect(state.configured).toBe(false)

  resetDeviceGpuCacheForTests(device)
})

test('a superseded HAL does not release the swap chain of the one on its canvas', async () => {
  // Two HALs on ONE element, which `getContext('webgpu')` answers with one
  // shared context object: a display whose model prop swaps under it, or an init
  // that overlaps the cancelled one before it. The loser's dispose used to
  // unconfigure the winner's swap chain, and then every frame the live HAL drew
  // threw `Canvas not configured` — with no context-lost event to trigger any
  // recovery, so the display banners the raw DOMException until a page reload.
  const { canvas, state } = fakeCanvas()
  const { device, frames } = fakeDevice()
  const superseded = await makeHal(canvas, device)
  const live = await makeHal(canvas, device)

  superseded.dispose()

  expect(state.unconfigures).toBe(0)
  expect(state.configured).toBe(true)
  live.beginFrame(0, 0, 0)
  live.endFrame()
  expect(frames.passes).toBe(1)

  live.dispose()
  expect(state.unconfigures).toBe(1)

  resetDeviceGpuCacheForTests(device)
})

test('a frame whose swap chain went missing rebuilds it and draws', async () => {
  const { canvas, context, state } = fakeCanvas()
  const { device, frames } = fakeDevice()
  const hal = await makeHal(canvas, device)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

  context.unconfigure()
  hal.beginFrame(0, 0, 0)
  hal.endFrame()

  // The frame that found it missing paints — it is the one asking for the
  // texture, so a rebuild in time is a frame recovered, not a frame lost.
  expect(state.configured).toBe(true)
  expect(frames.passes).toBe(1)
  expect(frames.submits).toBe(1)
  hal.beginFrame(0, 0, 0)
  hal.endFrame()
  expect(frames.passes).toBe(2)
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]![0]).toMatch(/lost its swap chain/)

  warn.mockRestore()
  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('a swap chain that cannot be rebuilt is reported once, not rebuilt per frame', async () => {
  const { canvas, context } = fakeCanvas()
  const { device } = fakeDevice()
  const hal = await makeHal(canvas, device)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const errors: Error[] = []
  hal.setErrorHandler(e => errors.push(e))

  context.unconfigure()
  jest.spyOn(context, 'configure').mockImplementation(() => {})
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})

  hal.beginFrame(0, 0, 0)
  hal.endFrame()
  hal.beginFrame(0, 0, 0)
  hal.endFrame()

  // One report, and the failed reconfigure is not attempted a second time —
  // every later frame would rebuild a swap chain to no effect. The display's
  // own Retry is what builds a fresh HAL.
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toMatch(/lost its GPU swap chain/)
  expect(context.configure).toHaveBeenCalledTimes(1)

  warn.mockRestore()
  errorLog.mockRestore()
  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('a disposed HAL draws nothing', async () => {
  // dispose() releases the swap chain, so a frame encoded after it is a
  // guaranteed `Canvas not configured` throw out of the render autorun.
  const { canvas } = fakeCanvas()
  const { device, frames } = fakeDevice()
  const hal = await makeHal(canvas, device)

  hal.dispose()
  hal.beginFrame(0, 0, 0)
  hal.endFrame()

  expect(frames.encoders).toBe(0)
  expect(frames.passes).toBe(0)

  resetDeviceGpuCacheForTests(device)
})
