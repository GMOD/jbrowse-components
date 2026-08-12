import {
  availableRenderers,
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

// The probes are memoized per page, so a test that wants its own answer needs
// its own copy of the module — `jest.resetModules` gives one, exactly as
// render-core's gpuDevice.test.ts does.
async function loadFreshModule() {
  jest.resetModules()
  return import('./getGraphicsCapabilities.ts')
}

// jsdom's getContext has no webgl2, so a spy is the only way to say "this
// machine has WebGL2" — and it is also how the probe is counted. getContext is
// overloaded per context id, so the stand-in is cast to the whole signature
// rather than matching one arm of it.
function mockGetContext(webgl2Context: object | null) {
  return jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(((id: string) =>
      id === 'webgl2'
        ? webgl2Context
        : null) as unknown as HTMLCanvasElement['getContext'])
}

const mockWebgl2 = (supported: boolean) => mockGetContext(supported ? {} : null)

afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: undefined,
  })
})

test('captures GPU vendor/architecture when a WebGPU adapter is available', async () => {
  mockGpu({ info: { vendor: 'nvidia', architecture: 'ampere' } })
  const { getGraphicsCapabilities } = await loadFreshModule()
  const caps = await getGraphicsCapabilities()
  expect(caps.webgpu).toBe(true)
  expect(caps.gpuVendor).toBe('nvidia')
  expect(caps.gpuArchitecture).toBe('ampere')
})

test('omits GPU vendor/architecture when WebGPU is unavailable', async () => {
  mockGpu(undefined)
  const { getGraphicsCapabilities } = await loadFreshModule()
  const caps = await getGraphicsCapabilities()
  expect(caps.webgpu).toBe(false)
  expect(caps.gpuVendor).toBeUndefined()
  expect(caps.gpuArchitecture).toBeUndefined()
})

test('WebGPU skips the WebGL2 probe, so no context is created', async () => {
  mockGpu({ info: { vendor: 'apple', architecture: 'metal-3' } })
  const getContext = mockWebgl2(true)
  const { getGraphicsCapabilities } = await loadFreshModule()

  const caps = await getGraphicsCapabilities()

  expect(caps.webgpu).toBe(true)
  expect(caps.webgl2).toBeUndefined()
  expect(getContext).not.toHaveBeenCalled()
})

test('no WebGPU falls through to the WebGL2 probe', async () => {
  mockGpu(undefined)
  const getContext = mockWebgl2(true)
  const { getGraphicsCapabilities } = await loadFreshModule()

  const caps = await getGraphicsCapabilities()

  expect(caps.webgl2).toBe(true)
  expect(getContext).toHaveBeenCalledWith('webgl2')
})

test('the probe never loses its context deliberately', async () => {
  mockGpu(undefined)
  // A context whose extension lookup would answer — if the probe asked for
  // WEBGL_lose_context, this would record it. It must not: loseContext() is
  // driver-wide on Firefox (ADR-005) and logs to the console on both browsers.
  const getExtension = jest.fn()
  mockGetContext({ getExtension })
  const { getGraphicsCapabilities } = await loadFreshModule()

  await getGraphicsCapabilities()

  expect(getExtension).not.toHaveBeenCalled()
})

test('the probe is memoized: repeat calls create no further contexts', async () => {
  mockGpu(undefined)
  const getContext = mockWebgl2(true)
  const { getGraphicsCapabilities, getFullGraphicsCapabilities } =
    await loadFreshModule()

  await getGraphicsCapabilities()
  await getGraphicsCapabilities()
  await getFullGraphicsCapabilities()

  expect(getContext).toHaveBeenCalledTimes(1)
})

test('getFullGraphicsCapabilities resolves WebGL2 that WebGPU let us skip', async () => {
  mockGpu({ info: { vendor: 'nvidia', architecture: 'ampere' } })
  const getContext = mockWebgl2(true)
  const { getGraphicsCapabilities, getFullGraphicsCapabilities } =
    await loadFreshModule()

  expect((await getGraphicsCapabilities()).webgl2).toBeUndefined()
  const full = await getFullGraphicsCapabilities()

  expect(full.webgpu).toBe(true)
  expect(full.webgl2).toBe(true)
  expect(availableRenderers(full)).toEqual(['WebGPU', 'WebGL2', 'Canvas2D'])
  // once for the full probe, never for the cheap one
  expect(getContext).toHaveBeenCalledTimes(1)
})

test('preferredRenderer prefers WebGPU, then WebGL2, then Canvas2D', () => {
  expect(preferredRenderer({ webgpu: true, webgl2: true })).toBe('WebGPU')
  // the shape the cheap probe returns on a WebGPU machine
  expect(preferredRenderer({ webgpu: true })).toBe('WebGPU')
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
  // an unprobed rung is not claimed
  expect(availableRenderers({ webgpu: true })).toEqual(['WebGPU', 'Canvas2D'])
})
