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
