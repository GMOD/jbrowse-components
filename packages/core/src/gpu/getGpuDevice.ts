/// <reference types="@webgpu/types" />

let device: GPUDevice | null = null
let devicePromise: Promise<GPUDevice | null> | null = null
const deviceLostListeners = new WeakMap<GPUDevice, Set<() => void>>()

export function onDeviceLost(listener: () => void) {
  if (device) {
    let listeners = deviceLostListeners.get(device)
    if (!listeners) {
      listeners = new Set()
      deviceLostListeners.set(device, listeners)
    }
    listeners.add(listener)
  }
  return () => {
    if (device) {
      deviceLostListeners.get(device)?.delete(listener)
    }
  }
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
    void d.lost.then(info => {
      console.error('[GPU] Device lost:', info.message)
      device = null
      devicePromise = null
      const listeners = deviceLostListeners.get(d)
      if (listeners) {
        for (const listener of listeners) {
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

let gpuOverride: string | null | undefined

export function getGpuOverride() {
  if (gpuOverride === undefined) {
    gpuOverride =
      new URLSearchParams(window.location.search).get('renderer') ?? null
  }
  return gpuOverride
}

export default function getGpuDevice() {
  const override = getGpuOverride()
  if (override === 'webgl' || override === 'off' || override === 'canvas2d') {
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
