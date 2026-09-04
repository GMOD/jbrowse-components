import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

// A buffer destroyed while the frame's render pass is open is validated against
// `queue.submit`, not against when the draw was encoded — so a renderer that
// re-uploads a pass it already drew from (alignments' overlay region, once per
// section inside its block loop) used to lose the WHOLE frame, every other
// track's draws included. What is under test is the ordering the HAL now owes:
// the release lands after the submit, and it does land.
//
// The fake device logs both, in one list, because it is only their order that
// is the fix.
function fakeDevice() {
  const events: string[] = []
  let buffers = 0
  let submitThrows = false
  const device = {
    limits: {
      minUniformBufferOffsetAlignment: 256,
      maxTextureDimension2D: 8192,
      maxBufferSize: 1 << 30,
    },
    lost: new Promise(() => {}),
    addEventListener: () => {},
    createBuffer: () => {
      const id = buffers++
      return {
        destroy: () => {
          events.push(`destroy:${id}`)
        },
      }
    },
    createBindGroup: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createTexture: () => ({ createView: () => ({}), destroy: () => {} }),
    createCommandEncoder: () => ({
      beginRenderPass: () => ({ end: () => {} }),
      finish: () => ({}),
    }),
    pushErrorScope: () => {},
    popErrorScope: () => Promise.resolve(null),
    queue: {
      submit: () => {
        events.push('submit')
        if (submitThrows) {
          throw new Error('submit failed')
        }
      },
      writeBuffer: () => {},
    },
  }
  return {
    device: device as unknown as GPUDevice,
    events,
    failSubmit: () => {
      submitThrows = true
    },
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

// No descriptors and sampleCount 1: nothing here needs a shader compiler or an
// MSAA attachment. `drawPass` would find no pipeline, which is why the tests
// below assert on the upload/release ordering rather than on a draw — the
// deferral is keyed on the frame being open, not on what was drawn into it.
async function makeHal(device: GPUDevice) {
  installGpu(device)
  const hal = await WebGPUHal.create(fakeCanvas(), [], 64, 1)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  hal.resize(100, 40)
  return hal
}

const instance = new Float32Array([1, 2, 3, 4])

beforeAll(() => {
  Object.assign(globalThis, {
    GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 },
    GPUBufferUsage: { UNIFORM: 64, COPY_DST: 8, VERTEX: 32 },
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

test('a buffer replaced mid-frame is released after the submit, not during', async () => {
  const { device, events } = fakeDevice()
  const hal = await makeHal(device)

  hal.uploadBuffer(0, 'rect', instance, 1)
  hal.beginFrame(0, 0, 0)
  hal.uploadBuffer(0, 'rect', instance, 1)

  expect(events).toEqual([])

  hal.endFrame()

  // buffer 0 is the uniform ring, so the vertex buffer replaced above is 1.
  expect(events).toEqual(['submit', 'destroy:1'])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('outside a frame the release is immediate', async () => {
  const { device, events } = fakeDevice()
  const hal = await makeHal(device)

  hal.uploadBuffer(0, 'rect', instance, 1)
  hal.uploadBuffer(0, 'rect', instance, 1)

  expect(events).toEqual(['destroy:1'])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('deleteRegion defers through the registry hook', async () => {
  const { device, events } = fakeDevice()
  const hal = await makeHal(device)

  hal.uploadBuffer(0, 'rect', instance, 1)
  hal.uploadBuffer(1, 'rect', instance, 1)
  hal.beginFrame(0, 0, 0)
  hal.deleteRegion(0)
  hal.deleteRegion(1)

  expect(events).toEqual([])

  hal.endFrame()

  expect(events).toEqual(['submit', 'destroy:1', 'destroy:2'])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('a frame whose submit throws still releases what it deferred', async () => {
  const { device, events, failSubmit } = fakeDevice()
  const hal = await makeHal(device)
  failSubmit()

  hal.uploadBuffer(0, 'rect', instance, 1)
  hal.beginFrame(0, 0, 0)
  hal.uploadBuffer(0, 'rect', instance, 1)

  expect(() => {
    hal.endFrame()
  }).toThrow(/submit failed/)

  // A frame that threw is a frame no later endFrame runs for, so holding the
  // release past it would leak the buffer for the life of the HAL.
  expect(events).toEqual(['submit', 'destroy:1'])

  hal.dispose()
  resetDeviceGpuCacheForTests(device)
})

test('disposing mid-frame releases the deferred buffers rather than leaking them', async () => {
  const { device, events } = fakeDevice()
  const hal = await makeHal(device)

  hal.uploadBuffer(0, 'rect', instance, 1)
  hal.beginFrame(0, 0, 0)
  hal.uploadBuffer(0, 'rect', instance, 1)
  hal.dispose()

  // destroy:1 is the deferred replacement, destroy:2 the buffer that replaced
  // it, destroy:0 the uniform ring — all released, none submitted.
  expect(events).toEqual(['destroy:1', 'destroy:2', 'destroy:0'])

  resetDeviceGpuCacheForTests(device)
})
