export interface GraphicsCapabilities {
  webgpu: boolean
  webgl2: boolean
  gpuVendor?: string
  gpuArchitecture?: string
}

export async function getGraphicsCapabilities(): Promise<GraphicsCapabilities> {
  let webgpu = false
  let gpuVendor: string | undefined
  let gpuArchitecture: string | undefined
  try {
    // navigator.gpu is typed non-nullable but is undefined without WebGPU
    // support, so the try/catch guards that access as well as adapter failures
    const adapter = await navigator.gpu.requestAdapter()
    webgpu = !!adapter
    if (adapter) {
      // coarse, non-fingerprinting fields (e.g. "nvidia"/"apple") the browser
      // exposes on purpose — surfaced only in the local stack-trace dialog
      gpuVendor = adapter.info.vendor
      gpuArchitecture = adapter.info.architecture
    }
  } catch {}
  // probe-only context; release it so feature detection doesn't hold a GPU
  // context open for the rest of the session
  const gl = document.createElement('canvas').getContext('webgl2')
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return { webgpu, webgl2: !!gl, gpuVendor, gpuArchitecture }
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

export function availableRenderers(c: GraphicsCapabilities) {
  const list = []
  if (c.webgpu) {
    list.push('WebGPU')
  }
  if (c.webgl2) {
    list.push('WebGL2')
  }
  list.push('Canvas2D')
  return list
}
