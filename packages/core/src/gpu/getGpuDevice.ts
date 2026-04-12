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
    // Surface any WebGPU validation / out-of-memory / internal errors that
    // would otherwise be silently swallowed. Without this, a bad draw/pipeline
    // results in a blank canvas with no console output.
    d.addEventListener('uncapturederror', (event: unknown) => {
      const e = event as { error?: { message?: string } }
      console.error('[GPU] UNCAPTURED ERROR:', e.error?.message ?? event)
    })
    void d.lost.then(info => {
      console.error('[GPU] Device lost:', info.message)
      device = null
      devicePromise = null
      for (const listener of deviceLostListeners) {
        listener()
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
    // Guarded: workers have no `window`, and this is reachable from the LD
    // matrix RPC path (plugins/variants/VariantRPC/getLDMatrixGPU.ts).
    const search = typeof window !== 'undefined' ? window.location.search : ''
    gpuOverride = new URLSearchParams(search).get('renderer') ?? null
  }
  return gpuOverride
}

export default function getGpuDevice() {
  const override = getGpuOverride()
  if (
    override === 'webgl' ||
    override === 'canvas2d' ||
    override === 'canvas'
  ) {
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
