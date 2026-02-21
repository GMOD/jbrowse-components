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
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
      return null
    }
    const d = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    })
    void d.lost.then(info => {
      console.error('[getGpuDevice] Device lost:', info.message)
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
  } catch {
    return null
  }
}

export default function getGpuDevice() {
  if (device) {
    return Promise.resolve(device)
  }
  if (devicePromise) {
    return devicePromise
  }
  devicePromise = createDevice()
  return devicePromise
}
