import { resetGpuDeviceForTests } from '../gpuDevice.ts'
import * as linkShader from '../shaders/linkMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { resetDeviceGpuCacheForTests } from './deviceGpuCache.ts'
import { WebGPUHal } from './webgpuHal.ts'

// A display's uniform ring starts small and doubles when a frame writes more
// slots than it holds. The draws encoded before a growth bind the outgrown
// buffer, so what is under test is that it still receives the slots those
// draws read before the submit, and is released after it. The link pass
// samples a colour ramp, so its bind group is a textured one, which a new ring
// rebuilds on the pass's next draw.

const UNIFORM = 64

interface FakeBuffer {
  id: number
  destroy: () => void
}

function recordingDevice() {
  const events: string[] = []
  const rings = new Set<number>()
  const ringSizes: number[] = []
  const groupRing = new Map<unknown, number>()
  const drawnWith: number[] = []
  let buffers = 0
  const pass = {
    setPipeline: () => {},
    setBindGroup: (_index: number, group: unknown) => {
      drawnWith.push(groupRing.get(group)!)
    },
    setVertexBuffer: () => {},
    setScissorRect: () => {},
    setViewport: () => {},
    draw: () => {},
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
    createBuffer: ({ size, usage }: { size: number; usage: number }) => {
      const id = buffers++
      if (usage & UNIFORM) {
        rings.add(id)
        ringSizes.push(size)
      }
      return {
        id,
        destroy: () => {
          events.push(`destroy:${id}`)
        },
      }
    },
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createBindGroup: (desc: GPUBindGroupDescriptor) => {
      const group = {}
      const ring = [...desc.entries]
        .map(e => (e.resource as { buffer?: FakeBuffer }).buffer)
        .find(Boolean)
      groupRing.set(group, ring!.id)
      return group
    },
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
    queue: {
      submit: () => {
        events.push('submit')
      },
      writeBuffer: (
        buffer: FakeBuffer,
        _offset: number,
        _data: unknown,
        _dataOffset: number,
        size: number,
      ) => {
        if (rings.has(buffer.id)) {
          events.push(`write:${buffer.id}:${size}`)
        }
      },
      writeTexture: () => {},
    },
  }
  return {
    device: device as unknown as GPUDevice,
    events,
    ringSizes,
    drawnWith,
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

const desc = slangPass({ id: 'link', mod: linkShader, verticesPerInstance: 6 })
const slot = Math.ceil(desc.uniformByteSize / 256) * 256

async function makeHal(device: GPUDevice) {
  installGpu(device)
  const hal = await WebGPUHal.create(fakeCanvas(), [desc], 1)
  if (!hal) {
    throw new Error('fake stack failed to build a HAL')
  }
  hal.resize(100, 40)
  hal.uploadTexture('link', new Uint8Array(256 * 4), 256, 1)
  hal.uploadBuffer(0, 'link', new ArrayBuffer(desc.instanceStride), 1)
  return hal
}

function frame(hal: WebGPUHal, writes: number) {
  hal.beginFrame(0, 0, 0)
  for (let i = 0; i < writes; i++) {
    hal.writeUniforms(new ArrayBuffer(desc.uniformByteSize))
    hal.drawPass('link', 0)
  }
  hal.endFrame()
}

beforeAll(() => {
  Object.assign(globalThis, {
    GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 },
    GPUBufferUsage: { UNIFORM, COPY_DST: 8, VERTEX: 32 },
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

test('a display starts with a small ring and a frame of a few writes stays in it', async () => {
  const fake = recordingDevice()
  const hal = await makeHal(fake.device)
  frame(hal, 4)
  expect(fake.ringSizes).toEqual([16 * slot])
  expect(fake.events).toEqual(['write:0:' + 4 * slot, 'submit'])
  hal.dispose()
  resetDeviceGpuCacheForTests(fake.device)
})

test('a frame past the ring doubles it, and every draw reads the slots it was written', async () => {
  const fake = recordingDevice()
  const hal = await makeHal(fake.device)
  frame(hal, 40)
  expect(fake.ringSizes).toEqual([16 * slot, 32 * slot, 64 * slot])
  const [a, b, c] = [0, 2, 3]
  expect(fake.drawnWith).toEqual([
    ...Array<number>(16).fill(a),
    ...Array<number>(16).fill(b),
    ...Array<number>(8).fill(c),
  ])
  // Each outgrown ring takes the prefix its draws read, before the submit,
  // and goes after it.
  expect(fake.events).toEqual([
    `write:${a}:${16 * slot}`,
    `write:${b}:${32 * slot}`,
    `write:${c}:${40 * slot}`,
    'submit',
    `destroy:${a}`,
    `destroy:${b}`,
  ])

  fake.events.length = 0
  fake.drawnWith.length = 0
  frame(hal, 40)
  expect(fake.ringSizes).toHaveLength(3)
  expect(new Set(fake.drawnWith)).toEqual(new Set([c]))
  expect(fake.events).toEqual([`write:${c}:${40 * slot}`, 'submit'])
  hal.dispose()
  resetDeviceGpuCacheForTests(fake.device)
})
