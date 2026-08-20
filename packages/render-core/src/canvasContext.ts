/**
 * A `<canvas>` holds exactly **one** context kind for its whole lifetime. Once
 * `getContext('webgl2')` has succeeded on an element, `getContext('2d')` on that
 * same element returns `null` forever — not because Canvas2D is unavailable, but
 * because the element is spoken for. The browser gives no reason: every failure
 * mode of `getContext` is the same `null`.
 *
 * That collision is not hypothetical here. The HAL ladder (WebGPU → WebGL2 →
 * Canvas2D) picks a kind per backend init, and a **re-init on a reused element**
 * can pick a different one than last time — a WebGPU device loss where the
 * device can't be re-acquired drops to WebGL2, which then finds the canvas
 * already committed to `webgpu`. The remedy is a fresh element (`RenderCanvas`,
 * keyed on `useRenderingBackend`'s `canvasKey`), and the point of this module is
 * that the error *says so* instead of reporting "WebGL2 not supported" on a
 * machine that supports WebGL2 perfectly well.
 *
 * We track it ourselves because the platform offers no way to ask a canvas which
 * kind it holds. A `WeakMap` rather than a DOM attribute: nothing should be able
 * to observe or edit this from the outside, and a detached canvas must stay
 * collectable.
 */
export type CanvasContextKind = 'webgpu' | 'webgl2' | '2d'

const KIND_LABELS: Record<CanvasContextKind, string> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL2',
  '2d': 'Canvas 2D',
}

const acquired = new WeakMap<HTMLCanvasElement, CanvasContextKind>()

const configuredBy = new WeakMap<HTMLCanvasElement, object>()

/**
 * Record `owner` as the holder of `canvas`'s current WebGPU configuration.
 *
 * `getContext('webgpu')` hands back the **same** `GPUCanvasContext` object every
 * time, so a configuration is per-element state that two HALs can end up
 * sharing: a re-init on a reused element (a display whose `model` prop swaps
 * under it, an init that overlaps a cancelled one) builds a second HAL on the
 * same context, and `unconfigure()` from whichever loses the race takes the
 * winner's swap chain with it. Firefox then throws `InvalidStateError:
 * GPUCanvasContext.getCurrentTexture: Canvas not configured` on every frame the
 * live HAL draws, forever — the browser fires no context-lost event for it, so
 * none of the loss recovery in `useRenderingBackend` ever runs.
 *
 * Last configure wins, which is the live one: a cancelled init is disposed, and
 * disposal is the only thing that unconfigures.
 */
export function noteCanvasConfigured(canvas: HTMLCanvasElement, owner: object) {
  configuredBy.set(canvas, owner)
}

/** Whether `owner`'s configuration is still the one on `canvas`. */
export function canvasConfiguredBy(canvas: HTMLCanvasElement, owner: object) {
  return configuredBy.get(canvas) === owner
}

/**
 * Record that `canvas` is now permanently committed to `kind`. Call on every
 * **successful** `getContext`, in every HAL and every Canvas2D backend — a kind
 * that isn't recorded is one the diagnosis below can't name, and it will fall
 * back to the vaguer message.
 */
export function noteCanvasContext(
  canvas: HTMLCanvasElement,
  kind: CanvasContextKind,
) {
  acquired.set(canvas, kind)
}

/** The kind this canvas is committed to, if we were the ones who took it. */
export function acquiredCanvasContext(canvas: HTMLCanvasElement) {
  return acquired.get(canvas)
}

/**
 * `getContext('2d')` + null-check + bookkeeping, as one call. Every Canvas2D
 * backend hand-wrote that ritual with the same bare message, which is four
 * copies of a diagnosis to keep in step — and three of them belong to the two
 * consumers whose canvas *never* unmounts (dotplot, the synteny level), i.e.
 * exactly where a reused element is reachable.
 */
export function acquireCanvas2D(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw canvasContextError(canvas, '2d')
  }
  noteCanvasContext(canvas, '2d')
  return ctx
}

/**
 * The error to throw when `getContext(requested)` returned null.
 *
 * Keeps each caller's historical message as the first clause (`Canvas 2D context
 * not available`, and tests match on it) and appends the *reason*, which is the
 * part that was missing: either "this element is already committed to X" — the
 * recoverable case, with the remedy named — or an honest statement of the two
 * possibilities when we don't know.
 */
export function canvasContextError(
  canvas: HTMLCanvasElement,
  requested: CanvasContextKind,
) {
  const prior = acquiredCanvasContext(canvas)
  const head = `${KIND_LABELS[requested]} context not available`
  return new Error(
    prior !== undefined && prior !== requested
      ? `${head}: this <canvas> element is already committed to a ${KIND_LABELS[prior]} context, and a canvas's context kind is permanent. This is a re-init on a reused element — it needs a fresh one. Mount the canvas with RenderCanvas (@jbrowse/render-core/RenderCanvas), which keys it on useRenderingBackend's canvasKey.`
      : `${head}: getContext('${requested}') returned null. Either this browser/machine does not support it, or the element is already committed to a different context kind (a canvas's kind is permanent once acquired).`,
  )
}
