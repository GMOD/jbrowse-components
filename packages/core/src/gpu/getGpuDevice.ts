/// <reference types="@webgpu/types" />

let device: GPUDevice | null = null
let devicePromise: Promise<GPUDevice | null> | null = null
let deviceLostHandler: ((recover: () => void) => void) | null = null

export function setDeviceLostHandler(handler: (recover: () => void) => void) {
  deviceLostHandler = handler
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
      deviceLostHandler?.(() => {
        void getGpuDevice()
      })
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
