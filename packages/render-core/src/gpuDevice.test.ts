import {
  getGpuDevice,
  getGpuOverride,
  isGpuRenderingDisabled,
  onDeviceLost,
  resetGpuDeviceForTests,
  setGpuOverride,
} from './gpuDevice.ts'

beforeEach(() => {
  resetGpuDeviceForTests()
  setGpuOverride(null)
})

afterEach(() => {
  resetGpuDeviceForTests()
  setGpuOverride(null)
})

test('returns null when override is webgl', async () => {
  setGpuOverride('webgl')
  expect(await getGpuDevice()).toBeNull()
})

test('returns null when override is canvas2d', async () => {
  setGpuOverride('canvas2d')
  expect(await getGpuDevice()).toBeNull()
})

test('returns null when override is canvas', async () => {
  setGpuOverride('canvas')
  expect(await getGpuDevice()).toBeNull()
})

test('getGpuOverride reflects setGpuOverride', () => {
  expect(getGpuOverride()).toBeNull()
  setGpuOverride('webgl')
  expect(getGpuOverride()).toBe('webgl')
  setGpuOverride(null)
  expect(getGpuOverride()).toBeNull()
})

test('returns null in Jest (no navigator.gpu)', async () => {
  // Jest runs in jsdom which has no WebGPU — getGpuDevice() falls through the
  // navigator.gpu check and resolves null.
  expect(await getGpuDevice()).toBeNull()
})

test('caches the promise — concurrent calls share one resolution', async () => {
  setGpuOverride('webgl') // force immediate null so we can race two calls
  const [a, b] = await Promise.all([getGpuDevice(), getGpuDevice()])
  expect(a).toBeNull()
  expect(b).toBeNull()
})

test('resetGpuDeviceForTests allows a fresh init after reset', async () => {
  setGpuOverride('webgl')
  await getGpuDevice() // primes devicePromise to a resolved-null
  resetGpuDeviceForTests()
  setGpuOverride('webgl')
  // After reset the module re-evaluates — still null, but via a new promise
  expect(await getGpuDevice()).toBeNull()
})

test('onDeviceLost registers and unregisters listener', () => {
  const listener = jest.fn()
  const off = onDeviceLost(listener)
  // Listener is registered — calling off removes it
  off()
  // No way to trigger device-lost in Jest, but we verify the unsub doesn't throw
  expect(listener).not.toHaveBeenCalled()
})

interface FakeDevice {
  lost: Promise<{ message: string }>
  resolveLost: (message: string) => void
  addEventListener: () => void
  limits: {
    maxTextureDimension2D: number
    maxBufferSize: number
    maxStorageBufferBindingSize: number
  }
}

function makeFakeDevice(): FakeDevice {
  let resolveLost: (info: { message: string }) => void = () => {}
  const lost = new Promise<{ message: string }>(res => {
    resolveLost = res
  })
  return {
    lost,
    resolveLost: (message: string) => {
      resolveLost({ message })
    },
    addEventListener: () => {},
    limits: {
      maxTextureDimension2D: 1,
      maxBufferSize: 1,
      maxStorageBufferBindingSize: 1,
    },
  }
}

function installFakeGpu(device: FakeDevice) {
  const adapter = {
    info: { vendor: 'fake', architecture: 'fake', description: 'fake' },
    limits: { maxStorageBufferBindingSize: 1, maxBufferSize: 1 },
    requestDevice: jest.fn().mockResolvedValue(device),
  }
  const requestAdapter = jest.fn().mockResolvedValue(adapter)
  // Override navigator.gpu for this test — jsdom has none by default.
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: { requestAdapter },
  })
  return requestAdapter
}

// A GPU stack that declines `requestAdapter` — what a machine without WebGPU
// looks like, and also what one looks like in the moments after a driver reset.
function installFailingGpu() {
  const requestAdapter = jest.fn().mockResolvedValue(null)
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: { requestAdapter },
  })
  return requestAdapter
}

function uninstallFakeGpu() {
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: undefined,
  })
}

test('lost-promise resolving on an old device does not null the current one', async () => {
  const deviceA = makeFakeDevice()
  installFakeGpu(deviceA)

  const a = await getGpuDevice()
  expect(a).toBe(deviceA)

  // Simulate test reset + re-init with a fresh device.
  resetGpuDeviceForTests()
  const deviceB = makeFakeDevice()
  installFakeGpu(deviceB)

  const b = await getGpuDevice()
  expect(b).toBe(deviceB)

  // Now resolve the OLD device's .lost promise. With the identity check,
  // this must NOT clear the module-level device (which now points at B).
  deviceA.resolveLost('simulated context loss on stale device')
  // Let the .then microtask flush.
  await Promise.resolve()
  await Promise.resolve()

  // getGpuDevice must still return device B — not re-trigger createDevice.
  const stillB = await getGpuDevice()
  expect(stillB).toBe(deviceB)

  uninstallFakeGpu()
})

test('lost-promise resolving on the current device clears it and notifies listeners', async () => {
  const device = makeFakeDevice()
  installFakeGpu(device)

  const got = await getGpuDevice()
  expect(got).toBe(device)

  const listener = jest.fn()
  onDeviceLost(listener)

  // Silence the expected '[GPU] Device lost: ...' error log.
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  device.resolveLost('test-induced loss')
  await Promise.resolve()
  await Promise.resolve()

  expect(listener).toHaveBeenCalledTimes(1)
  errSpy.mockRestore()

  // After loss, getGpuDevice should re-enter createDevice — install a new fake
  // and observe a fresh init (the prior promise/device are nulled).
  const device2 = makeFakeDevice()
  installFakeGpu(device2)
  expect(await getGpuDevice()).toBe(device2)

  uninstallFakeGpu()
})

test('caches a failed acquisition on a machine that never had a device', async () => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const requestAdapter = installFailingGpu()

  expect(await getGpuDevice()).toBeNull()
  expect(await getGpuDevice()).toBeNull()

  // Never had a device, so the decline is a fact about this machine: ask once
  // and let every later backend read the memo. No retry delay either.
  expect(requestAdapter).toHaveBeenCalledTimes(1)

  warnSpy.mockRestore()
  uninstallFakeGpu()
})

test('retries and does not cache a failed re-acquisition after a device loss', async () => {
  jest.useFakeTimers()
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  const device = makeFakeDevice()
  installFakeGpu(device)
  expect(await getGpuDevice()).toBe(device)

  device.resolveLost('driver reset')
  await Promise.resolve()
  await Promise.resolve()

  // The stack has not come back up: this is what the re-init that follows the
  // loss actually sees, since it asks within a frame of it.
  const requestAdapter = installFailingGpu()
  const first = getGpuDevice()
  await jest.advanceTimersByTimeAsync(3 * 700)
  expect(await first).toBeNull()

  // Asked more than once, unlike the never-had-a-device case above.
  expect(requestAdapter).toHaveBeenCalledTimes(3)

  // And crucially the null is NOT the page's permanent answer. Without this,
  // `createGpuHal` reads it as "no WebGPU on this machine" and every display
  // built for the rest of the session runs on WebGL2.
  const device2 = makeFakeDevice()
  installFakeGpu(device2)
  expect(await getGpuDevice()).toBe(device2)

  warnSpy.mockRestore()
  errSpy.mockRestore()
  uninstallFakeGpu()
  jest.useRealTimers()
})

// --- Two copies of this module on one page ---
//
// What a statically-bundled plugin produces. ADR-030 keeps the GPU surface out
// of the ReExports ABI on purpose, so a third-party display carries its own
// render-core — and everything in this file above this line would still pass
// with per-copy module state while the plugin quietly ignored the host's
// `?renderer=` and its "disable GPU" button. These are the tests that fail
// without the globalThis cell.
//
// `jest.resetModules` clears the registry, so the `import` below evaluates the
// module a second time while the static imports at the top of this file stay
// bound to the first copy: two live instances, one page.
async function loadSecondCopy() {
  jest.resetModules()
  return import('./gpuDevice.ts')
}

test('a second copy sees the host page-wide override', async () => {
  setGpuOverride('canvas2d')

  const plugin = await loadSecondCopy()

  // Per-copy state reads its own untouched `gpuOverride` for all three: null,
  // false, and an attempt to take a device on a page the user has explicitly
  // pinned away from the GPU.
  expect(plugin.getGpuOverride()).toBe('canvas2d')
  expect(plugin.isGpuRenderingDisabled()).toBe(true)
  expect(await plugin.getGpuDevice()).toBeNull()
})

test('an override set by a second copy reaches the host', async () => {
  const plugin = await loadSecondCopy()

  // Both directions matter: the "disable GPU" banner belongs to whichever
  // display errored, so the write can originate in either copy.
  plugin.setGpuOverride('canvas2d')

  expect(getGpuOverride()).toBe('canvas2d')
  expect(isGpuRenderingDisabled()).toBe(true)
})

test('two copies share one GPUDevice rather than taking one each', async () => {
  const requestAdapter = installFakeGpu(makeFakeDevice())
  const device = await getGpuDevice()

  const plugin = await loadSecondCopy()

  // Same device, and no second `requestAdapter`. A per-copy memo would take a
  // second physical device with its own `.lost` handling, and spend from the
  // page's WebGL2 context budget (reference/GPU_CONTEXT_BUDGET.md) where the
  // host's accounting cannot see it.
  expect(await plugin.getGpuDevice()).toBe(device)
  expect(requestAdapter).toHaveBeenCalledTimes(1)

  uninstallFakeGpu()
})

test('a device lost in one copy notifies listeners registered in the other', async () => {
  const device = makeFakeDevice()
  installFakeGpu(device)
  expect(await getGpuDevice()).toBe(device)

  const plugin = await loadSecondCopy()
  const hostListener = jest.fn()
  const pluginListener = jest.fn()
  onDeviceLost(hostListener)
  plugin.onDeviceLost(pluginListener)

  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  device.resolveLost('test-induced loss')
  await Promise.resolve()
  await Promise.resolve()
  errSpy.mockRestore()

  expect(hostListener).toHaveBeenCalledTimes(1)
  expect(pluginListener).toHaveBeenCalledTimes(1)

  uninstallFakeGpu()
})

test('resetGpuDeviceForTests in one copy is seen by the other', async () => {
  installFakeGpu(makeFakeDevice())
  await getGpuDevice()

  const plugin = await loadSecondCopy()
  // Resets the cell's fields in place. Reassigning the cell would leave this
  // copy holding the old object, and the two would silently diverge from there.
  plugin.resetGpuDeviceForTests()

  const device2 = makeFakeDevice()
  installFakeGpu(device2)
  expect(await getGpuDevice()).toBe(device2)

  uninstallFakeGpu()
})
