import {
  SV_TYPE_FIELD,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { colord } from '@jbrowse/core/util/colord'

export const CHORD_ALPHA = 0.45

const SV_TYPE = categoricalField(SV_TYPE_FIELD)

export function chordColorForType(type: string) {
  return colord(SV_TYPE.color(type)).alpha(CHORD_ALPHA).toRgbString()
}
