import {
  availableRenderers,
  getGraphicsCapabilities,
  preferredRenderer,
} from './getGraphicsCapabilities.ts'

// jsdom has no navigator.gpu; define a minimal stub. `value` on a property
// descriptor is untyped, so the partial adapter needs no cast.
function mockGpu(
  adapter: { info: { vendor: string; architecture: string } } | undefined,
) {
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: adapter && { requestAdapter: () => Promise.resolve(adapter) },
  })
}

afterEach(() => {
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: undefined,
  })
})

test('captures GPU vendor/architecture when a WebGPU adapter is available', async () => {
  mockGpu({ info: { vendor: 'nvidia', architecture: 'ampere' } })
  const caps = await getGraphicsCapabilities()
  expect(caps.webgpu).toBe(true)
  expect(caps.gpuVendor).toBe('nvidia')
  expect(caps.gpuArchitecture).toBe('ampere')
})

test('omits GPU vendor/architecture when WebGPU is unavailable', async () => {
  mockGpu(undefined)
  const caps = await getGraphicsCapabilities()
  expect(caps.webgpu).toBe(false)
  expect(caps.gpuVendor).toBeUndefined()
  expect(caps.gpuArchitecture).toBeUndefined()
})

test('preferredRenderer prefers WebGPU, then WebGL2, then Canvas2D', () => {
  expect(preferredRenderer({ webgpu: true, webgl2: true })).toBe('WebGPU')
  expect(preferredRenderer({ webgpu: false, webgl2: true })).toBe('WebGL2')
  expect(preferredRenderer({ webgpu: false, webgl2: false })).toBe('Canvas2D')
})

test('availableRenderers lists supported backends with Canvas2D always last', () => {
  expect(availableRenderers({ webgpu: true, webgl2: true })).toEqual([
    'WebGPU',
    'WebGL2',
    'Canvas2D',
  ])
  expect(availableRenderers({ webgpu: false, webgl2: false })).toEqual([
    'Canvas2D',
  ])
})
