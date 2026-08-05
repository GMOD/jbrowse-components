/// <reference types="@webgpu/types" />

let device: GPUDevice | null = null
// devicePromise serializes concurrent calls during async init and after recovery.
let devicePromise: Promise<GPUDevice | null> | null = null
const deviceLostListeners = new Set<() => void>()

// Proof that this machine's WebGPU works, set the first time a device is
// acquired. It is what makes a failed acquisition readable, because the two
// causes are indistinguishable at the call site and want opposite handling:
//
//  - Before it, failure means "no WebGPU here" — the ordinary path on most
//    hardware. Cache it, so every later backend skips the rung for free.
//  - After it, failure means the GPU stack has not come back up yet. The
//    re-init that follows `device.lost` asks for an adapter within a frame of
//    the loss, and on a sleep/wake or a driver reset that is exactly when
//    `requestAdapter` still declines. So this is not a rare race — it is the
//    expected timing of the one path that re-acquires.
//
// Caching the second kind is what `createGpuHal` then reads as "no WebGPU on
// this machine" (its own words), silently pinning the whole page to WebGL2
// until a reload. So past this flag a failure is retried and never cached.
let hadDevice = false

// Enough to outlast a wake-up, and only ever spent once `hadDevice` is set — a
// machine without WebGPU declines on the first ask and waits for nothing.
const REACQUIRE_TRIES = 3
const REACQUIRE_DELAY_MS = 700

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

async function acquire() {
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
  return { adapter, device: d }
}

// One ask on a machine that has never produced a device, several on one that
// has. See `hadDevice`: only the latter is asking again worth anything, and
// only there is a decline evidence of a stack still coming up rather than of
// hardware that simply cannot do this.
async function acquireWithRetry() {
  const tries = hadDevice ? REACQUIRE_TRIES : 1
  for (let attempt = 1; attempt <= tries; attempt++) {
    const last = attempt === tries
    try {
      const got = await acquire()
      if (got || last) {
        return got
      }
    } catch (e) {
      if (last) {
        throw e
      }
      console.warn(`[GPU] device acquisition failed (${attempt}/${tries}):`, e)
    }
    await new Promise(resolve => setTimeout(resolve, REACQUIRE_DELAY_MS))
  }
  return null
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
    const got = await acquireWithRetry()
    if (!got) {
      return null
    }
    const { adapter, device: d } = got
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
    hadDevice = true
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
 * Whether the GPU is off for the whole page — either pinned by `?renderer=` at
 * startup or switched off from a display's GPU-error banner after an
 * unrecoverable WebGL context loss. `createGpuHal` returns null in that case, so
 * every backend built from then on is the Canvas2D one.
 */
export function isGpuRenderingDisabled() {
  return gpuOverride === 'canvas2d' || gpuOverride === 'canvas'
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
  hadDevice = false
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
  const pending = createDevice()
  devicePromise = pending
  // Nothing re-asks on its own — every backend built from here on reads this
  // memo — so a cached failure is permanent for the life of the page. That is
  // the right answer for hardware that has no WebGPU and the wrong one for a
  // stack that is still coming back up, and `hadDevice` is which. Drop the memo
  // on the second, so the next display to build asks again instead of
  // inheriting a demotion to WebGL2 that no longer reflects the machine.
  void pending.then(d => {
    if (!d && hadDevice && devicePromise === pending) {
      devicePromise = null
    }
  })
  return pending
}
