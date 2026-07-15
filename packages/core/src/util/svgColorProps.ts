import { colord } from './colord.ts'

export function stripAlpha(str: string) {
  return colord(str).alpha(1).toHex()
}

function svgColorProps(str: string, colorKey: string, opacityKey: string) {
  if (str) {
    const c = colord(str)
    return {
      [opacityKey]: c.alpha(),
      [colorKey]: c.alpha(1).toHex(),
    }
  } else {
    return {}
  }
}

export function getStrokeProps(str: string) {
  return svgColorProps(str, 'stroke', 'strokeOpacity')
}

export function getFillProps(str: string) {
  return svgColorProps(str, 'fill', 'fillOpacity')
}
