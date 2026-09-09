import { isGpuContextLostError } from '../gpuContextLostError.ts'
import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

// The Chrome/Dawn shape, which is NOT the Firefox one `webgpuHalSwapChain.test`
// covers: on a driver that refuses the canvas image, `getCurrentTexture` does
// not throw. It raises a device error and hands back an error texture, whose
// `createView` hands back an error view, and the frame encodes against it — so
// every guard written around a `catch` sees a healthy frame. Measured on an AMD
// Radeon PRO WX 3200 under Chrome 152, where Dawn's Vulkan external-memory
// import asks for fewer bytes than the image needs.
const DAWN_MESSAGE =
  'Requested allocation size (1310720) is smaller than the image requires (1313808).'

type Scope = { filter: string; error: string | null }

/**
 * A device whose error scopes are a real filtered stack, because that is what
 * the change under test turns on: a raised error lands in the innermost scope
 * whose filter matches, so a scope pushed with the wrong filter — or popped out
 * of order — shows up here rather than passing.
 */
function fakeDevice() {
  const scopes: Scope[] = []
  const log = { pushed: 0, popped: 0, uncaptured: [] as string[] }
  const raise = (message: string, kind = 'validation') => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const scope = scopes[i]!
      if (scope.filter === kind) {
        scope.error ??= message
        return
      }
    }
    log.uncaptured.push(message)
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
    createBindGroup: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createTexture: () => ({ createView: () => ({}), destroy: () => {} }),
    createCommandEncoder: () => ({
      beginRenderPass: () => ({ end: () => {} }),
      finish: () => ({}),
    }),
    pushErrorScope: (filter: string) => {
      log.pushed++
      scopes.push({ filter, error: null })
    },
    popErrorScope: () => {
      log.popped++
      const scope = scopes.pop()
      return Promise.resolve(scope?.error ? { message: scope.error } : null)
    },
    queue: { submit: () => {}, writeBuffer: () => {} },
  }
  return { device: device as unknown as GPUDevice, log, scopes, raise }
}

function fakeCanvas(onAcquire: () => void, throwOnAcquire = false) {
  const context = {
    configure: () => {},
    unconfigure: () => {},
    getCurrentTexture: () => {
      onAcquire()
      if (throwOnAcquire) {
        throw new DOMException(
          'GPUCanvasContext.getCurrentTexture: Canvas not configured',
          'InvalidStateError',
        )
      }
      return { createView: () => ({ view: 'canvas' }) }
    },
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

async function makeHal(canvas: HTMLCanvasElement, device: GPUDevice) {
  installGpu(device)
  const hal = await WebGPUHal.create(canvas, [], 4)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  hal.resize(100, 40)
  return hal
}

// `popErrorScope` resolves on the microtask queue; the reports it drives land a
// turn after the frame that raised them.
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

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

test('a refused canvas image reaches the display flagged for the Canvas2D fallback', async () => {
  const { device, log, raise } = fakeDevice()
  const canvas = fakeCanvas(() => {
    raise(DAWN_MESSAGE)
  })
  const hal = await makeHal(canvas, device)
  const errors: unknown[] = []
  hal.setErrorHandler(e => errors.push(e))

  jest.spyOn(console, 'error').mockImplementation(() => {})
  for (let i = 0; i < 3; i++) {
    hal.beginFrame(0, 0, 0)
    hal.endFrame()
  }
  await flush()

  // Once per HAL, not once per frame: the condition holds for every frame at
  // this canvas size, and dotplot/synteny keep their canvas mounted through the
  // banner, so a per-frame report never stops.
  expect(errors).toHaveLength(1)
  expect(isGpuContextLostError(errors[0])).toBe(true)
  // The root cause, not the `[Invalid TextureView]` cascade the frame's own
  // scope sees after the submit.
  expect((errors[0] as Error).message).toContain(DAWN_MESSAGE)
  expect(log.pushed).toBe(log.popped)
  expect(log.uncaptured).toEqual([])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('a healthy frame reports nothing and leaves no scope on the stack', async () => {
  const { device, log, scopes } = fakeDevice()
  const canvas = fakeCanvas(() => {})
  const hal = await makeHal(canvas, device)
  const errors: unknown[] = []
  hal.setErrorHandler(e => errors.push(e))

  hal.beginFrame(0, 0, 0)
  hal.endFrame()
  await flush()

  expect(errors).toEqual([])
  expect(log.pushed).toBe(3)
  expect(log.popped).toBe(3)
  expect(scopes).toEqual([])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('the acquisition scope is balanced on the path that yields no texture view', async () => {
  // Firefox's shape, and the one `beginFrame` early-returns on. The acquisition
  // scope is pushed before the frame's two, so it is the one that has to be
  // popped on a path that never creates an encoder — an orphan scope left here
  // would swallow every later frame's validation errors, silently.
  const { device, log, scopes } = fakeDevice()
  const canvas = fakeCanvas(() => {}, true)
  const hal = await makeHal(canvas, device)

  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  hal.beginFrame(0, 0, 0)
  hal.endFrame()
  await flush()

  expect(log.pushed).toBe(1)
  expect(log.popped).toBe(1)
  expect(scopes).toEqual([])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('an out-of-memory raise during acquisition is not read as a surface refusal', async () => {
  // The acquisition scope filters on `validation`. If it is ever widened, or the
  // frame's `out-of-memory` scope is pushed before it, this is what changes.
  const { device, log, raise } = fakeDevice()
  const canvas = fakeCanvas(() => {
    raise('some out-of-memory condition', 'out-of-memory')
  })
  const hal = await makeHal(canvas, device)
  const errors: unknown[] = []
  hal.setErrorHandler(e => errors.push(e))

  hal.beginFrame(0, 0, 0)
  hal.endFrame()
  await flush()

  expect(errors).toEqual([])
  expect(log.uncaptured).toEqual(['some out-of-memory condition'])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})
