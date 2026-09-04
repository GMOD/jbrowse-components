import {
  getBuiltRenderer,
  getGpuOverride,
  isGpuRenderingDisabled,
} from './gpuDevice.ts'

export interface GraphicsCapabilities {
  webgpu: boolean
  /**
   * `undefined` when the WebGL2 probe was skipped, which is what
   * `getGraphicsCapabilities` does whenever WebGPU answered first — see there.
   */
  webgl2?: boolean
  gpuVendor?: string
  gpuArchitecture?: string
  /**
   * `UNMASKED_RENDERER_WEBGL` from the WebGL2 probe — the real driver string
   * ("SwiftShader Device", "Mesa Intel(R) UHD Graphics 630"), not the masked
   * one, which is a fixed placeholder. Present only when the probe ran (no
   * WebGPU) and the browser exposes `WEBGL_debug_renderer_info`; Firefox with
   * `privacy.resistFingerprinting` does not. It identifies hardware far more
   * precisely than `gpuVendor`/`gpuArchitecture` do, so like them it stays
   * local — the stack-trace dialog the user chooses to copy — and never goes to
   * analytics. `softwareWebgl` is the coarse bit that does.
   */
  glRenderer?: string
  /**
   * Whether that driver string names a software rasterizer. `undefined` means
   * unknown (no probe, or no extension), which is deliberately not `false`: the
   * distinction is the whole value of the field.
   */
  softwareWebgl?: boolean
}

/**
 * The rungs of the rendering ladder, as the names a person reads — the About
 * widget's "Graphics:" line, the stack-trace dialog, the analytics field.
 *
 * Deliberately *not* the {@link GpuOverride} vocabulary, which is what a user
 * types into `?renderer=` and therefore carries lowercase spellings and the
 * `webgl`/`canvas` aliases. One is an input to parse, the other an answer to
 * display, and collapsing them would mean either showing "canvas2d" in the UI
 * or accepting "Canvas2D" in a URL.
 */
export type RendererName = 'WebGPU' | 'WebGL2' | 'Canvas2D'

// Substrings of UNMASKED_RENDERER_WEBGL that mean "no GPU is involved". Kept
// conservative and specific — a wrong `true` here would describe a real GPU as
// software, and the reports built from it are what a later ladder decision would
// rest on. Chrome's SwiftShader arrives as an ANGLE string ("ANGLE (Google,
// Vulkan 1.3.0 (SwiftShader Device ...))"), which is why these are substring
// tests rather than equality.
const SOFTWARE_RENDERER_MARKERS = [
  'swiftshader',
  'llvmpipe',
  'lavapipe',
  'softpipe',
  'software rasterizer',
  'software renderer',
  'microsoft basic render driver',
]

/**
 * Whether a `UNMASKED_RENDERER_WEBGL` string names a software rasterizer, where
 * WebGL costs ~25x Canvas2D on the main thread for the same session (measured;
 * on real hardware the ordering reverses at ~2x). Exported for its test — the
 * marker list is the part that can be wrong.
 */
export function isSoftwareRenderer(glRenderer: string) {
  const lower = glRenderer.toLowerCase()
  return SOFTWARE_RENDERER_MARKERS.some(marker => lower.includes(marker))
}

async function probeWebgpu() {
  try {
    // navigator.gpu is typed non-nullable but is undefined without WebGPU
    // support, so the try/catch guards that access as well as adapter failures
    const adapter = await navigator.gpu.requestAdapter()
    return adapter
      ? {
          webgpu: true,
          // coarse, non-fingerprinting fields (e.g. "nvidia"/"apple") the
          // browser exposes on purpose — surfaced only in the local stack-trace
          // dialog
          gpuVendor: adapter.info.vendor,
          gpuArchitecture: adapter.info.architecture,
        }
      : { webgpu: false }
  } catch {
    return { webgpu: false }
  }
}

/**
 * Whether a WebGL2 context can be created, which costs one. The context is not
 * released with `WEBGL_lose_context.loseContext()`, deliberately: on Firefox
 * that call is effectively driver-wide (ADR-005 removed it from
 * `WebGL2Hal.dispose()` for the same reason), so probing while tracks were on
 * screen knocked out their live sibling contexts — and both browsers log the
 * loss to the console, which is what a user sees. The canvas is unreachable the
 * moment this returns and the browser reclaims the context on GC, the same
 * release the HAL relies on. A page that then reaches the 16-context ceiling
 * evicts this one first (it is the oldest, and nothing draws to it or
 * re-acquires it), so the eviction cascade in GPU_CONTEXT_BUDGET.md cannot
 * start here.
 *
 * The driver string comes off the same context, so it is free where it matters:
 * this only runs when WebGPU is absent, which is the population that renders on
 * WebGL2 and so the only one whose rasterizer changes anything.
 */
function probeWebgl2() {
  const canvas = document.createElement('canvas')
  // 1x1 rather than the default 300x150: nothing is ever drawn, so the drawing
  // buffer is pure waste until GC takes it
  canvas.width = 1
  canvas.height = 1
  const gl = canvas.getContext('webgl2')
  if (!gl) {
    return { webgl2: false }
  }
  // UNMASKED_RENDERER_WEBGL, not RENDERER — the masked one is a fixed
  // placeholder string ("WebKit WebGL") that names nothing
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  const glRenderer = ext
    ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string | null)
    : null
  return glRenderer
    ? {
        webgl2: true,
        glRenderer,
        softwareWebgl: isSoftwareRenderer(glRenderer),
      }
    : { webgl2: true }
}

let capabilities: Promise<GraphicsCapabilities> | undefined

/**
 * What this machine can do, memoized for the page: capabilities cannot change
 * within a session, and every call that probed again was another WebGL2 context
 * (each reopening of the About widget or the stack-trace dialog made one).
 *
 * **The WebGL2 probe is skipped when WebGPU is available**, leaving `webgl2`
 * undefined, because it is the rung below and nothing reads it:
 * {@link effectiveRenderer} returns WebGPU regardless. So a WebGPU machine
 * creates no WebGL2 context at all.
 *
 * Nothing needs the skipped rung resolved, and a "probe everything" variant was
 * deleted for it: {@link effectiveRenderer} already encodes the whole capability
 * vector, since `Canvas2D` means neither rung exists and `WebGL2` means WebGPU
 * is missing. The only bit a full probe adds is whether a WebGPU machine *also*
 * has WebGL2 — which no shipping browser answers no to, and which nothing would
 * do anything with. Report the effective renderer instead of a list.
 *
 * This is capabilities alone. What will actually draw is
 * {@link effectiveRenderer}, which is this plus the page-wide pin.
 */
export function getGraphicsCapabilities(): Promise<GraphicsCapabilities> {
  capabilities ??= probeWebgpu().then(gpu =>
    gpu.webgpu ? gpu : { ...gpu, ...probeWebgl2() },
  )
  return capabilities
}

/**
 * Which rung draws. Once `createGpuHal` has built one on this page, the rung it
 * returned is the answer — the adapter probe says WebGPU where
 * `WebGPUHal.create` then throws and the ladder lands on WebGL2. Before any
 * backend exists it is the ladder read as an answer rather than run, from what
 * the machine can do *and* the page-wide pin from `?renderer=` or the
 * GPU-error banner's "disable GPU" button. This is the question every consumer
 * asks: the About widget's "Graphics:" line, the stack-trace dialog's
 * environment block, the analytics field.
 *
 * The Canvas2D pin is checked ahead of the record because the banner's
 * "disable GPU" sets it before the displays rebuild on the new rung. The other
 * pins win outright in the prediction, because **a pin never falls through to
 * the next rung** — `createGpuHal` throws instead, on the reasoning that a
 * pinned renderer which silently substitutes another makes any comparison
 * against it wrong. So the pinned rung *is* the answer, and a pin that cannot
 * be honored surfaces as a `renderError` rather than as a different string
 * here. The one case the prediction cannot resolve from capabilities alone
 * (`?renderer=webgl` on a WebGPU machine, where the WebGL2 probe was skipped)
 * is also the case where the pin decides on its own.
 *
 * **`softwareWebgl` skips the WebGL2 rung here because it skips it there**, and
 * only where the ladder skips it — unpinned. Leaving it out is not a rounding
 * error on a rare machine: the VM, the locked-down laptop and the remote desktop
 * are exactly the population the rung-skip exists for, so the one group that
 * newly falls back was the one group still reported as WebGL2, in the About box,
 * in the stack traces users paste into bug reports, and in the analytics field
 * whose stated purpose is counting that fallback.
 *
 * Keeping this beside `gpuDevice` is the point of the module living in
 * render-core: it was previously in `@jbrowse/core`, which cannot see the
 * override, so every consumer reported the capability answer and a user who had
 * clicked "Use Canvas2D" was still reported as WebGL2.
 */
export function effectiveRenderer(c: GraphicsCapabilities): RendererName {
  if (isGpuRenderingDisabled()) {
    return 'Canvas2D'
  }
  const built = getBuiltRenderer()
  if (built) {
    return built
  }
  const override = getGpuOverride()
  if (override === 'webgl') {
    return 'WebGL2'
  }
  if (override === 'webgpu') {
    return 'WebGPU'
  }
  if (c.webgpu) {
    return 'WebGPU'
  }
  // `softwareWebgl` is `undefined` where the browser withholds
  // WEBGL_debug_renderer_info, and an unknown rasterizer keeps the rung — the
  // same reading `createGpuHal` gives it.
  if (c.webgl2 && !c.softwareWebgl) {
    return 'WebGL2'
  }
  return 'Canvas2D'
}
