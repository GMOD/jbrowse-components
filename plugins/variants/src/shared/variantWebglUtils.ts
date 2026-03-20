import { colord } from '@jbrowse/core/util/colord'

export {
  cacheUniforms,
  createProgram,
  createShader,
  splitPositionWithFrac,
} from '@jbrowse/core/gpu/webglUtils'

export function colorToRGBA(color: string): [number, number, number, number] {
  const c = colord(color)
  const { r, g, b, a } = c.toRgb()
  return [r, g, b, Math.round(a * 255)]
}

export function createCachedRGBA() {
  const colorCache = new Map<string, [number, number, number, number]>()
  return function getCachedRGBA(color: string) {
    let rgba = colorCache.get(color)
    if (!rgba) {
      rgba = colorToRGBA(color)
      colorCache.set(color, rgba)
    }
    return rgba
  }
}
