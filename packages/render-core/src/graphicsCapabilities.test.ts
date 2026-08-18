import { setGpuOverride } from './gpuDevice.ts'
import {
  effectiveRenderer,
  isSoftwareRenderer,
} from './graphicsCapabilities.ts'

const UNMASKED_RENDERER_WEBGL = 0x9246

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
// gpuDevice.test.ts does. The override does *not* reset with it: that lives on
// a globalThis cell by design, which is why afterEach clears it by hand.
async function loadFreshModule() {
  jest.resetModules()
  return import('./graphicsCapabilities.ts')
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

// A WebGL2 context that answers the driver-string query, or withholds the
// extension the way Firefox does under privacy.resistFingerprinting.
function webgl2Context(glRenderer: string | null) {
  return {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info' && glRenderer !== null
        ? { UNMASKED_RENDERER_WEBGL }
        : null,
    getParameter: (parameter: number) =>
      parameter === UNMASKED_RENDERER_WEBGL ? glRenderer : null,
  }
}

const mockWebgl2 = (supported: boolean) =>
  mockGetContext(
    supported ? webgl2Context('Mesa Intel(R) UHD Graphics 630') : null,
  )

afterEach(() => {
  jest.restoreAllMocks()
  setGpuOverride(null)
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
  // The probe does ask for one extension (the driver string), so this records
  // which. It must never be WEBGL_lose_context: loseContext() is driver-wide on
  // Firefox (ADR-005) and logs to the console on both browsers.
  const getExtension = jest.fn()
  mockGetContext({ getExtension })
  const { getGraphicsCapabilities } = await loadFreshModule()

  await getGraphicsCapabilities()

  expect(getExtension).not.toHaveBeenCalledWith('WEBGL_lose_context')
})

test('reads the unmasked driver string and flags a software rasterizer', async () => {
  mockGpu(undefined)
  mockGetContext(
    webgl2Context('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))'),
  )
  const { getGraphicsCapabilities } = await loadFreshModule()

  const caps = await getGraphicsCapabilities()

  expect(caps.glRenderer).toContain('SwiftShader')
  expect(caps.softwareWebgl).toBe(true)
})

test('a real GPU is not flagged', async () => {
  mockGpu(undefined)
  mockGetContext(webgl2Context('Mesa Intel(R) UHD Graphics 630'))
  const { getGraphicsCapabilities } = await loadFreshModule()

  const caps = await getGraphicsCapabilities()

  expect(caps.glRenderer).toBe('Mesa Intel(R) UHD Graphics 630')
  expect(caps.softwareWebgl).toBe(false)
})

test('a withheld extension leaves the rasterizer unknown, not false', async () => {
  mockGpu(undefined)
  // Firefox with privacy.resistFingerprinting
  mockGetContext(webgl2Context(null))
  const { getGraphicsCapabilities } = await loadFreshModule()

  const caps = await getGraphicsCapabilities()

  expect(caps.webgl2).toBe(true)
  expect(caps.glRenderer).toBeUndefined()
  expect(caps.softwareWebgl).toBeUndefined()
})

test('a WebGPU machine reports no driver string, since nothing probed', async () => {
  mockGpu({ info: { vendor: 'apple', architecture: 'metal-3' } })
  mockGetContext(webgl2Context('ANGLE (SwiftShader Device)'))
  const { getGraphicsCapabilities } = await loadFreshModule()

  const caps = await getGraphicsCapabilities()

  expect(caps.glRenderer).toBeUndefined()
  expect(caps.softwareWebgl).toBeUndefined()
})

// The first string of each group is a real capture, not a plausible one: Chrome
// 151 on this repo's dev box reports the SwiftShader line headless and the Intel
// line headed (2026-08-12, via a scratch puppeteer run). The rest are the
// shapes the marker list is meant to cover.
test('isSoftwareRenderer knows the rasterizers and leaves hardware alone', () => {
  for (const software of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'lavapipe (LLVM 17.0.6, 256 bits)',
    'Software Rasterizer',
    'Microsoft Basic Render Driver',
  ]) {
    expect(isSoftwareRenderer(software)).toBe(true)
  }
  for (const hardware of [
    'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL ES 3.2)',
    'Mesa Intel(R) UHD Graphics 630',
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Apple M1 Pro',
    'AMD Radeon Pro 5500M OpenGL Engine',
  ]) {
    expect(isSoftwareRenderer(hardware)).toBe(false)
  }
})

test('the probe is memoized: repeat calls create no further contexts', async () => {
  mockGpu(undefined)
  const getContext = mockWebgl2(true)
  const { getGraphicsCapabilities } = await loadFreshModule()

  await getGraphicsCapabilities()
  await getGraphicsCapabilities()

  expect(getContext).toHaveBeenCalledTimes(1)
})

// effectiveRenderer reads the whole capability vector, which is why nothing
// needs the skipped rung resolved: each answer names the rungs that exist.
test('effectiveRenderer walks the ladder WebGPU, then WebGL2, then Canvas2D', () => {
  expect(effectiveRenderer({ webgpu: true, webgl2: true })).toBe('WebGPU')
  // the shape the probe returns on a WebGPU machine, where WebGL2 goes unprobed
  expect(effectiveRenderer({ webgpu: true })).toBe('WebGPU')
  expect(effectiveRenderer({ webgpu: false, webgl2: true })).toBe('WebGL2')
  expect(effectiveRenderer({ webgpu: false, webgl2: false })).toBe('Canvas2D')
})

// The bug the move to render-core exists to fix: in @jbrowse/core this function
// could not see the override, so a user who had clicked "Use Canvas2D" on the
// context-loss banner was still reported as WebGL2 — in the About widget, in the
// stack-trace dialog they were about to send us, and in analytics.
test('a Canvas2D pin wins over what the machine can do', () => {
  setGpuOverride('canvas2d')
  expect(effectiveRenderer({ webgpu: true, webgl2: true })).toBe('Canvas2D')
})

test('the `canvas` alias pins the same rung as `canvas2d`', () => {
  setGpuOverride('canvas')
  expect(effectiveRenderer({ webgpu: true, webgl2: true })).toBe('Canvas2D')
})

// A pin never falls through — createGpuHal throws rather than substituting a
// rung — so the pinned rung is the answer even where capabilities disagree or,
// for `webgl` on a WebGPU machine, were never probed at all.
test('a WebGL2 pin reports WebGL2 on a machine that also has WebGPU', () => {
  setGpuOverride('webgl')
  expect(effectiveRenderer({ webgpu: true })).toBe('WebGL2')
})

test('a WebGPU pin reports WebGPU even where the probe found none', () => {
  setGpuOverride('webgpu')
  expect(effectiveRenderer({ webgpu: false, webgl2: true })).toBe('WebGPU')
})

// The rung-skip in createGpuHal, read back as an answer. This is the population
// the skip exists for — a VM, a locked-down laptop, a remote desktop — so a
// reader that missed it reported WebGL2 for exactly the machines that newly fall
// back, in the About box, in pasted stack traces, and in the analytics field
// whose whole purpose is counting that fallback.
test('a software rasterizer reports the rung it actually lands on', () => {
  expect(
    effectiveRenderer({ webgpu: false, webgl2: true, softwareWebgl: true }),
  ).toBe('Canvas2D')
})

// Firefox under privacy.resistFingerprinting withholds
// WEBGL_debug_renderer_info, so the rasterizer is unknown rather than software —
// and createGpuHal keeps the rung on that reading.
test('an unknown rasterizer keeps the WebGL2 rung', () => {
  expect(
    effectiveRenderer({
      webgpu: false,
      webgl2: true,
      softwareWebgl: undefined,
    }),
  ).toBe('WebGL2')
})

// A pin never falls through, so it outranks the skip too: the browser-test
// runner pins every GPU arm and runs under SwiftShader, and a reader that
// reported those arms as Canvas2D would describe the cross-backend gate as
// comparing a backend with itself.
test('a WebGL2 pin outranks the software-rasterizer skip', () => {
  setGpuOverride('webgl')
  expect(
    effectiveRenderer({ webgpu: false, webgl2: true, softwareWebgl: true }),
  ).toBe('WebGL2')
})

test('an unrecognized pin is no pin, so the ladder decides', () => {
  // setGpuOverride rejects what it does not know and clears the pin, warning as
  // it goes — gpuDevice.test.ts pins that behavior; this pins what it means here
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  setGpuOverride('WebGL')
  expect(effectiveRenderer({ webgpu: false, webgl2: true })).toBe('WebGL2')
  expect(warnSpy).toHaveBeenCalled()
})
