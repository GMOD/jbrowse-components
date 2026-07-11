export interface GraphicsCapabilities {
  webgpu: boolean
  webgl2: boolean
}

export async function getGraphicsCapabilities(): Promise<GraphicsCapabilities> {
  let webgpu = false
  try {
    // navigator.gpu is typed non-nullable but is undefined without WebGPU
    // support, so the try/catch guards that access as well as adapter failures
    webgpu = !!(await navigator.gpu.requestAdapter())
  } catch {}
  // probe-only context; release it so feature detection doesn't hold a GPU
  // context open for the rest of the session
  const gl = document.createElement('canvas').getContext('webgl2')
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return { webgpu, webgl2: !!gl }
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
