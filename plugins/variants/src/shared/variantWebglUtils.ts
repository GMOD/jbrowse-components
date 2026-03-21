import { cssColorToRgba } from '@jbrowse/core/util/colorBits'

export {
  cacheUniforms,
  createProgram,
  createShader,
  splitPositionWithFrac,
} from '@jbrowse/core/gpu/webglUtils'

export function colorToRGBA(color: string): [number, number, number, number] {
  return cssColorToRgba(color)
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
