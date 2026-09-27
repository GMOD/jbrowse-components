import {
  SV_TYPE_FIELD,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { colord } from '@jbrowse/core/util/colord'
import { svClassOf } from '@jbrowse/core/util/svAlt'

import type { Feature } from '@jbrowse/core/util'

const CHORD_ALPHA = 0.45

const SV_TYPE = categoricalField(SV_TYPE_FIELD)

// the color slot is re-evaluated on every chord render, hover included
const alphaColors = new Map<string, string>()

export function chordColorForType(type: string) {
  let color = alphaColors.get(type)
  if (color === undefined) {
    color = colord(SV_TYPE.color(type)).alpha(CHORD_ALPHA).toRgbString()
    alphaColors.set(type, color)
  }
  return color
}

export function svChordColor(feature: Feature) {
  return chordColorForType(svClassOf(feature))
}
