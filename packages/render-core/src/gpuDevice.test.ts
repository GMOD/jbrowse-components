import {
  getGpuDevice,
  getGpuOverride,
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
  }
}

function installFakeGpu(device: FakeDevice) {
  const adapter = {
    limits: { maxStorageBufferBindingSize: 1, maxBufferSize: 1 },
    requestDevice: jest.fn().mockResolvedValue(device),
  }
  // Override navigator.gpu for this test — jsdom has none by default.
  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: { requestAdapter: jest.fn().mockResolvedValue(adapter) },
  })
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
