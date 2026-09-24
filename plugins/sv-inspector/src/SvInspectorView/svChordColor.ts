import { colord } from '@jbrowse/core/util/colord'
import { getSvTypeColor, getVariantSvType } from '@jbrowse/plugin-variants'

import type { Feature } from '@jbrowse/core/util'

const CHORD_ALPHA = 0.45

// the color slot is re-evaluated on every chord render, hover included
const alphaColors = new Map<string, string>()

export function chordColorForType(type: string) {
  let color = alphaColors.get(type)
  if (color === undefined) {
    color = colord(getSvTypeColor(type)).alpha(CHORD_ALPHA).toRgbString()
    alphaColors.set(type, color)
  }
  return color
}

export function svChordColor(feature: Feature) {
  return chordColorForType(getVariantSvType(feature))
}
