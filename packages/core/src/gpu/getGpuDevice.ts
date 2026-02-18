/// <reference types="@webgpu/types" />

let device: GPUDevice | null = null
let devicePromise: Promise<GPUDevice | null> | null = null

export default function getGpuDevice() {
  if (device) {
    return Promise.resolve(device)
  }
  if (devicePromise) {
    return devicePromise
  }
  devicePromise = (async () => {
    try {
      const adapter = await navigator.gpu?.requestAdapter()
      if (!adapter) {
        return null
      }
      const d = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize:
            adapter.limits.maxStorageBufferBindingSize ?? 134217728,
          maxBufferSize: adapter.limits.maxBufferSize ?? 268435456,
        },
      })
      d.lost.then(info => {
        console.error('[getGpuDevice] Device lost:', info.message)
        device = null
        devicePromise = null
      })
      device = d
      return d
    } catch {
      return null
    }
  })()
  return devicePromise
}
