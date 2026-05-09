export interface GraphicsCapabilities {
  webgpu: boolean
  webgl2: boolean
}

export async function getGraphicsCapabilities(): Promise<GraphicsCapabilities> {
  let webgpu = false
  try {
    webgpu = !!(await navigator.gpu.requestAdapter())
  } catch {}
  const webgl2 = !!document.createElement('canvas').getContext('webgl2')
  return { webgpu, webgl2 }
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
