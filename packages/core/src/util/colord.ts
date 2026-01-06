import { colord as colordOriginal, extend, Colord as ColordBase } from 'colord'
import type { AnyColor } from 'colord'
import mix from 'colord/plugins/mix'
import names from 'colord/plugins/names'

// Extend Colord interface with mix plugin methods
export interface Colord extends ColordBase {
  mix(color2: AnyColor | Colord, ratio?: number): Colord
  tints(count?: number): Colord[]
  shades(count?: number): Colord[]
  tones(count?: number): Colord[]
}

let initialized = false

function ensurePlugins() {
  if (!initialized) {
    extend([mix, names])
    initialized = true
  }
}

export function colord(input: Parameters<typeof colordOriginal>[0]): Colord {
  ensurePlugins()
  return colordOriginal(input) as Colord
}
