const CONTEXT_LOST_MESSAGE =
  'WebGL context lost. The browser reclaimed the GPU context for this display, ' +
  'usually because too many GPU-rendered views are open at once.'

const DEVICE_LOST_MESSAGE =
  'WebGPU device lost. The GPU device backing this display went away and kept ' +
  'going away after several attempts to rebuild on a fresh one.'

const SURFACE_LOST_MESSAGE =
  'WebGPU could not give this display a drawable surface. The GPU driver ' +
  'rejected the canvas image, so every frame this display submits is discarded.'

/**
 * Flagged rather than matched by message or `instanceof`, so the error UI can
 * offer the remedy specific to a loss (switch the page to Canvas2D) without
 * offering it for render errors whose remedy differs (an over-allocation says to
 * zoom in).
 *
 * A lost WebGPU device carries the same flag deliberately: the two causes
 * differ, but the remedy on offer — take the page off the GPU — is the same one.
 *
 * React-free, and split out of `useRenderingBackend` for that reason: the HAL
 * raises the surface error below and must not import a hook to do it.
 * `useRenderingBackend` re-exports these, so every existing import site keeps
 * working.
 */
export function createGpuContextLostError(message = CONTEXT_LOST_MESSAGE) {
  return Object.assign(new Error(message), {
    gpuContextLost: true as const,
  })
}

export function createGpuDeviceLostError() {
  return createGpuContextLostError(DEVICE_LOST_MESSAGE)
}

/**
 * A canvas whose swap-chain image the driver refuses. Distinct from a device
 * loss, because the device is fine and still renders offscreen, and distinct
 * from an over-limit allocation, because zooming in does not fix it. Canvas2D
 * does, which is why this carries the flag that puts that button on the banner.
 */
export function createGpuSurfaceLostError(detail: string) {
  return createGpuContextLostError(`${SURFACE_LOST_MESSAGE} (${detail})`)
}

export function isGpuContextLostError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'gpuContextLost' in error
  )
}
