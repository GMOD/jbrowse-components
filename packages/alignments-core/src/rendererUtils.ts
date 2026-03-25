// Shared renderer utilities for WebGL/WebGPU backends.
// Generic GPU utilities live in @jbrowse/core/gpu/ — this file has
// higher-level helpers used by instanced-draw renderers.

// Re-export generic GPU utilities for convenience
export {
  STANDARD_BLEND_STATE,
  createStandardBindGroup,
  createStandardBindGroupLayout,
  createStorageBuffer,
} from '@jbrowse/core/gpu/webgpuUtils'
export { enableStandardBlend } from '@jbrowse/core/gpu/webglUtils'

export function getDevicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio : 2
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const dpr = getDevicePixelRatio()
  const pw = Math.round(width * dpr)
  const ph = Math.round(height * dpr)
  const changed = canvas.width !== pw || canvas.height !== ph
  if (changed) {
    canvas.width = pw
    canvas.height = ph
  }
  return { pw, ph, changed }
}

export interface PickingFbo {
  fbo: WebGLFramebuffer
  colorTex: WebGLTexture
  width: number
  height: number
}

export function createPickingFbo(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  existing?: PickingFbo,
) {
  if (existing) {
    gl.deleteFramebuffer(existing.fbo)
    gl.deleteTexture(existing.colorTex)
  }
  if (w === 0 || h === 0) {
    return undefined
  }

  const colorTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, colorTex)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    colorTex,
    0,
  )
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { fbo, colorTex, width: w, height: h } satisfies PickingFbo
}
