/// <reference types="@webgpu/types" />

import type { RendererName } from './graphicsCapabilities.ts'

interface GpuDeviceCell {
  device: GPUDevice | null
  /** Serializes concurrent calls during async init and after recovery. */
  devicePromise: Promise<GPUDevice | null> | null
  /**
   * Proof that this machine's WebGPU works, set the first time a device is
   * acquired. It is what makes a failed acquisition readable, because the two
   * causes are indistinguishable at the call site and want opposite handling:
   *
   *  - Before it, failure means "no WebGPU here" — the ordinary path on most
   *    hardware. Cache it, so every later backend skips the rung for free.
   *  - After it, failure means the GPU stack has not come back up yet. The
   *    re-init that follows `device.lost` asks for an adapter within a frame of
   *    the loss, and on a sleep/wake or a driver reset that is exactly when
   *    `requestAdapter` still declines. So this is not a rare race — it is the
   *    expected timing of the one path that re-acquires.
   *
   * Caching the second kind is what `createGpuHal` then reads as "no WebGPU on
   * this machine" (its own words), silently pinning the whole page to WebGL2
   * until a reload. So past this flag a failure is retried and never cached.
   */
  hadDevice: boolean
  deviceLostListeners: Set<() => void>
  /**
   * Stays `string | null` rather than {@link GpuOverride} because the cell is
   * shared with other copies of this module, including older ones whose
   * `setGpuOverride` took any string without checking. Everything that reads it
   * treats an unrecognized value as no pin.
   *
   * @see setGpuOverride
   */
  gpuOverride: string | null
  /**
   * The rung the last `createGpuHal` returned, so `effectiveRenderer` reports
   * what drew rather than what the probe predicted. Optional because a cell an
   * older copy built has none, and "nothing built yet" is a real state there.
   */
  builtRenderer?: RendererName
}

declare global {
  var __jbrowseRenderCoreGpuDeviceV1: GpuDeviceCell | undefined
}

/**
 * The page-wide GPU state, and the one thing in this package that **must not be
 * duplicated** — so it is anchored on `globalThis` rather than held in module
 * locals, and every copy of this module on the page shares one cell.
 *
 * The rest of render-core is duplication-safe: classes, mixins and geometry
 * helpers, all of which a second copy can own its own instances of. This is
 * not. `device` is one physical GPU device, and `gpuOverride` is a *page-wide*
 * policy written by the host — `?renderer=` at startup, and the "disable GPU"
 * button on the context-loss banner, which `packages/render-core/CLAUDE.md`
 * names as the only sanctioned fallback path once a backend is built.
 *
 * A statically-bundled plugin is the case this exists for. ADR-030 makes the
 * GPU surface static-import-only, so a third-party display carries its own copy
 * of this module by design; with module locals its `gpuOverride` would start
 * null and stay null, and the user who pins `?renderer=canvas2d` or clicks
 * "disable GPU" after a crash would watch the plugin ignore both and take
 * WebGPU anyway. Sharing the cell fixes that without putting anything in the
 * frozen `ReExports` ABI — which is the trade ADR-030 declined, and rightly.
 *
 * **The shape is a cross-version contract.** Copies at different render-core
 * versions meet here, and whichever loads first wins the initialization, so a
 * field added later would read `undefined` on a cell built by an older copy.
 * Changing this interface therefore means bumping the `V1` in the global's
 * name, which costs the sharing between the two versions — the point of the
 * suffix is that losing it is a decision rather than a silent misread. The one
 * exception is an optional field whose `undefined` is an honest state, as
 * `builtRenderer`'s is. Reset in place (see `resetGpuDeviceForTests`); never
 * reassign the cell itself, or copies holding the old object diverge from the
 * new one.
 */
const cell = (globalThis.__jbrowseRenderCoreGpuDeviceV1 ??= {
  device: null,
  devicePromise: null,
  hadDevice: false,
  deviceLostListeners: new Set(),
  gpuOverride: null,
})

// Enough to outlast a wake-up, and only ever spent once `hadDevice` is set — a
// machine without WebGPU declines on the first ask and waits for nothing.
const REACQUIRE_TRIES = 3
const REACQUIRE_DELAY_MS = 700

// Nothing here calls `device.destroy()`, and nothing should. It is not an
// omission.
//
// Destroying a device that has presented frames stops the browser delivering
// animation frames to the whole *tab*, permanently: the tab still reports
// `visible`, the browser stays responsive, and a reload lands in the same dead
// tab because the damage outlives the document. Only a new tab clears it.
// Measured on Firefox Nightly / Linux in a sibling WebGPU app (phosphene,
// `docs/adr/0004-never-destroy-a-presenting-device.md`, repro
// `scripts/devicetear.mjs`), with the controls that pin the mechanism: creating
// and destroying devices with no canvas is free, so is configuring a swapchain
// and destroying without presenting. Presenting and then destroying is the one
// arm that kills the tab. So this is about pulling a live swapchain out from
// under the compositor, not about devices being scarce.
//
// Two edits reintroduce it, and both read as tidying up rather than as a
// regression, which is why this comment is here instead of a code guard:
//
//  - a `destroyGpuDevice()` mirroring `resetGpuDeviceForTests` below.
//  - releasing the device on `pagehide` or on the last display unmounting. That
//    exact one-liner is what made every refresh cost a tab in the app that
//    measured this.
//
// Letting go is the whole recovery story instead. A lost device is already
// gone (the `.lost` handler drops the reference and the next ask acquires a
// fresh one), and an abandoned one is reclaimed when the document goes, so the
// leak is bounded by a reload rather than accumulating over a session. Its
// pipelines and shader modules live until then, while the large VRAM is
// returned either way because `WebGPUHal.dispose` destroys its own buffers and
// textures.
//
// `WebGPUHal.dispose`'s `context.unconfigure()` is not this and is fine to
// keep: dropping a swapchain is the sanctioned way to release one, and every
// track unmount already does it many times a session without consequence.

export function onDeviceLost(listener: () => void) {
  cell.deviceLostListeners.add(listener)
  return () => {
    cell.deviceLostListeners.delete(listener)
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
  const tries = cell.hadDevice ? REACQUIRE_TRIES : 1
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
      // Identity check: if the shared device has already been replaced (test
      // reset + re-init, or a subsequent successful createDevice), the
      // resolution of the old device's `.lost` promise must NOT null out the
      // newer device. Without this guard the new device's reference is
      // silently cleared on the next getGpuDevice() call.
      if (cell.device === d) {
        console.error('[GPU] Device lost:', info.message)
        cell.device = null
        cell.devicePromise = null
        for (const listener of cell.deviceLostListeners) {
          listener()
        }
      }
    })
    cell.device = d
    cell.hadDevice = true
    return d
  } catch (e) {
    console.warn('[GPU] WebGPU device creation failed:', e)
    return null
  }
}

/**
 * The renderers `?renderer=` can pin the page to. `canvas` is a spelling of
 * `canvas2d` kept because it is in the wild.
 *
 * A pin means *only* that rung — `createGpuHal` does not fall past it. That is
 * the whole point of the flag: it exists to compare backends, and a comparison
 * whose subject silently substitutes itself is worse than no comparison. The
 * failure is visible instead, as a `renderError` carrying the pin that could
 * not be honored, with the banner's "disable GPU" as the way out.
 */
export const GPU_OVERRIDES = ['webgpu', 'webgl', 'canvas2d', 'canvas'] as const

export type GpuOverride = (typeof GPU_OVERRIDES)[number]

function isGpuOverride(value: string): value is GpuOverride {
  return (GPU_OVERRIDES as readonly string[]).includes(value)
}

/**
 * Pin the page to a renderer, or clear the pin with `null`. Page-wide by
 * design and shared across every copy of this module — see {@link GpuDeviceCell}.
 *
 * Takes a bare `string` because both callers hand it one straight off a URL
 * (`?renderer=` in jbrowse-web's `InitialLoad`, the same param fed by desktop's
 * `--renderer` flag), so validating here is validating once at the only place
 * an unchecked value enters. An unrecognized one clears the pin and says so:
 * before this, `?renderer=WebGL` or a typo was indistinguishable from passing
 * nothing at all, which is the one outcome a person debugging a renderer must
 * not silently get.
 */
export function setGpuOverride(value: string | null) {
  if (value !== null && !isGpuOverride(value)) {
    console.warn(
      `[GPU] ignoring unknown renderer "${value}" — expected one of ${GPU_OVERRIDES.join(', ')}. Rendering with the default ladder (WebGPU → WebGL2 → Canvas2D).`,
    )
    cell.gpuOverride = null
    return
  }
  cell.gpuOverride = value
}

export function getGpuOverride() {
  return cell.gpuOverride
}

export function setBuiltRenderer(name: RendererName) {
  cell.builtRenderer = name
}

export function getBuiltRenderer() {
  return cell.builtRenderer
}

/**
 * Whether the GPU is off for the whole page — either pinned by `?renderer=` at
 * startup or switched off from a display's GPU-error banner after an
 * unrecoverable WebGL context loss. `createGpuHal` returns null in that case, so
 * every backend built from then on is the Canvas2D one.
 *
 * Note this is narrower than "a pin is in force": `webgl` and `webgpu` are pins
 * too, and both leave GPU rendering on. The banner reads this to decide whether
 * to offer its escape, so it must stay the Canvas2D question specifically.
 */
export function isGpuRenderingDisabled() {
  return cell.gpuOverride === 'canvas2d' || cell.gpuOverride === 'canvas'
}

/**
 * Reset the shared singleton state. For use in tests only — clears `device` and
 * `devicePromise` so the next `getGpuDevice()` call starts fresh rather than
 * returning the cached (possibly null) promise from a previous test.
 *
 * It drops references and deliberately does not destroy the device, so this is
 * not the half of a pair that a `destroyGpuDevice()` completes. See the comment
 * above `onDeviceLost` for what destroying one costs.
 *
 * Resets the cell's fields rather than replacing the cell, so a second copy of
 * this module that captured it still sees the reset. `gpuOverride` is left
 * alone: it is set by the host and by individual tests, and clearing it here
 * would make the reset mean two different things.
 */
export function resetGpuDeviceForTests() {
  cell.device = null
  cell.devicePromise = null
  cell.hadDevice = false
  cell.deviceLostListeners.clear()
  cell.builtRenderer = undefined
}

export function getGpuDevice() {
  const override = getGpuOverride()
  if (override !== null && ['webgl', 'canvas2d', 'canvas'].includes(override)) {
    return Promise.resolve(null)
  }
  if (cell.device) {
    return Promise.resolve(cell.device)
  }
  if (cell.devicePromise) {
    return cell.devicePromise
  }
  const pending = createDevice()
  cell.devicePromise = pending
  // Nothing re-asks on its own — every backend built from here on reads this
  // memo — so a cached failure is permanent for the life of the page. That is
  // the right answer for hardware that has no WebGPU and the wrong one for a
  // stack that is still coming back up, and `hadDevice` is which. Drop the memo
  // on the second, so the next display to build asks again instead of
  // inheriting a demotion to WebGL2 that no longer reflects the machine.
  void pending.then(d => {
    if (!d && cell.hadDevice && cell.devicePromise === pending) {
      cell.devicePromise = null
    }
  })
  return pending
}
