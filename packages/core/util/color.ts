import { colord } from './colord'

export function stripAlpha(str: string) {
  return colord(str).alpha(1).toHex()
}

export function getStrokeProps(str: string) {
  if (str) {
    const c = colord(str)
    return {
      strokeOpacity: c.alpha(),
      stroke: c.alpha(1).toHex(),
    }
  } else {
    return {}
  }
}

export function getFillProps(str: string) {
  if (str) {
    const c = colord(str)
    return {
      fillOpacity: c.alpha(),
      fill: c.alpha(1).toHex(),
    }
  } else {
    return {}
  }
}
