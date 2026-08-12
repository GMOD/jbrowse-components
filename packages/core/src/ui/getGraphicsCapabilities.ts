export interface GraphicsCapabilities {
  webgpu: boolean
  /**
   * `undefined` when the WebGL2 probe was skipped, which is what
   * `getGraphicsCapabilities` does whenever WebGPU answered first — see there.
   */
  webgl2?: boolean
  gpuVendor?: string
  gpuArchitecture?: string
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
 */
function probeWebgl2() {
  const canvas = document.createElement('canvas')
  // 1x1 rather than the default 300x150: nothing is ever drawn, so the drawing
  // buffer is pure waste until GC takes it
  canvas.width = 1
  canvas.height = 1
  return !!canvas.getContext('webgl2')
}

let capabilities: Promise<GraphicsCapabilities> | undefined

/**
 * What the rendering ladder resolves to, memoized for the page: capabilities
 * cannot change within a session, and every call that probed again was another
 * WebGL2 context (each reopening of the About widget or the stack-trace dialog
 * made one).
 *
 * **The WebGL2 probe is skipped when WebGPU is available**, leaving `webgl2`
 * undefined, because it is the rung below and nothing reads it: `preferredRenderer`
 * returns WebGPU regardless. So a WebGPU machine creates no WebGL2 context at all.
 *
 * Nothing needs the skipped rung resolved, and a "probe everything" variant was
 * deleted for it: `preferredRenderer` already encodes the whole capability
 * vector, since `Canvas2D` means neither rung exists and `WebGL2` means WebGPU
 * is missing. The only bit a full probe adds is whether a WebGPU machine *also*
 * has WebGL2 — which no shipping browser answers no to, and which nothing would
 * do anything with. Report the preferred renderer instead of a list.
 */
export function getGraphicsCapabilities(): Promise<GraphicsCapabilities> {
  capabilities ??= probeWebgpu().then(gpu =>
    gpu.webgpu ? gpu : { ...gpu, webgl2: probeWebgl2() },
  )
  return capabilities
}

export function preferredRenderer(c: GraphicsCapabilities) {
  if (c.webgpu) {
    return 'WebGPU'
  }
  if (c.webgl2) {
    return 'WebGL2'
  }
  return 'Canvas2D'
}
