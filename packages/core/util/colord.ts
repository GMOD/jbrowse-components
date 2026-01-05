import { colord as colordOriginal, extend } from 'colord'
import mix from 'colord/plugins/mix'
import names from 'colord/plugins/names'

let initialized = false

function ensurePlugins() {
  if (!initialized) {
    extend([mix, names])
    initialized = true
  }
}

export function colord(input: Parameters<typeof colordOriginal>[0]) {
  ensurePlugins()
  return colordOriginal(input)
}

export type { Colord } from 'colord'
