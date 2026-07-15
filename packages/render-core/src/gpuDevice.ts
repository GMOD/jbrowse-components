/// <reference types="@webgpu/types" />

let device: GPUDevice | null = null
// devicePromise serializes concurrent calls during async init and after recovery.
let devicePromise: Promise<GPUDevice | null> | null = null
const deviceLostListeners = new Set<() => void>()

export function onDeviceLost(listener: () => void) {
  deviceLostListeners.add(listener)
  return () => {
    deviceLostListeners.delete(listener)
  }
}

// One-line record of what GPU a user's machine actually gave us. The whole
// point of the GPU path is scaling across hardware we can't see — when a report
// comes in of a blank/errored track, this is the difference between "which GPU
// and how much headroom" and pure guesswork. maxTextureDimension2D and
// maxBufferSize are the two limits our over-allocation guards trip on.
function logGpuCapabilities(adapter: GPUAdapter, device: GPUDevice) {
  const { vendor, architecture, description } = adapter.info
  const { maxTextureDimension2D, maxBufferSize, maxStorageBufferBindingSize } =
    device.limits
  console.warn(
    `[GPU] WebGPU device ready — vendor="${vendor}" architecture="${architecture}" description="${description}" ` +
      `maxTextureDimension2D=${maxTextureDimension2D} maxBufferSize=${maxBufferSize} maxStorageBufferBindingSize=${maxStorageBufferBindingSize}`,
  )
}

async function createDevice(): Promise<GPUDevice | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!navigator.gpu) {
      console.warn(
        '[GPU] WebGPU not supported in this browser. Falling back to WebGL2.',
      )
      return null
    }
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      console.warn(
        '[GPU] No compatible GPU adapter available. This may indicate WebGPU is disabled, unsupported hardware, or a system limitation. Falling back to WebGL2.',
      )
      return null
    }
    const d = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    })
    // Best-effort diagnostic: a logging failure (e.g. an environment that
    // doesn't populate adapter.info) must never abort device creation and drop
    // us to WebGL2.
    try {
      logGpuCapabilities(adapter, d)
    } catch (e) {
      console.warn('[GPU] capability logging failed (non-fatal):', e)
    }
    // Surface any WebGPU validation / out-of-memory / internal errors that
    // would otherwise be silently swallowed. Without this, a bad draw/pipeline
    // results in a blank canvas with no console output.
    d.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
      console.error('[GPU] UNCAPTURED ERROR:', event.error.message)
    })
    void d.lost.then(info => {
      // Identity check: if the module-level device has already been replaced
      // (test reset + re-init, or a subsequent successful createDevice), the
      // resolution of the old device's `.lost` promise must NOT null out the
      // newer device. Without this guard the new device's reference is
      // silently cleared on the next getGpuDevice() call.
      if (device === d) {
        console.error('[GPU] Device lost:', info.message)
        device = null
        devicePromise = null
        for (const listener of deviceLostListeners) {
          listener()
        }
      }
    })
    device = d
    return d
  } catch (e) {
    console.warn('[GPU] WebGPU device creation failed:', e)
    return null
  }
}

let gpuOverride: string | null = null

export function setGpuOverride(value: string | null) {
  gpuOverride = value
}

export function getGpuOverride() {
  return gpuOverride
}

/**
 * Reset module-level singleton state. For use in tests only — clears
 * `device` and `devicePromise` so the next `getGpuDevice()` call starts
 * fresh rather than returning the cached (possibly null) promise from a
 * previous test.
 */
export function resetGpuDeviceForTests() {
  device = null
  devicePromise = null
  deviceLostListeners.clear()
}

export function getGpuDevice() {
  const override = getGpuOverride()
  if (override !== null && ['webgl', 'canvas2d', 'canvas'].includes(override)) {
    return Promise.resolve(null)
  }
  if (device) {
    return Promise.resolve(device)
  }
  if (devicePromise) {
    return devicePromise
  }
  devicePromise = createDevice()
  return devicePromise
}
