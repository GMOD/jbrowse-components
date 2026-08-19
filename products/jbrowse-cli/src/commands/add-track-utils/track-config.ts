import path from 'node:path'

import { isURL } from '../../types/common.ts'
import { parseCommaSeparatedString } from '../../utils.ts'
import { displayDefaultKeysForTrackType } from '../validate/displayDefaultKeys.ts'
import { suggest } from '../validate/suggest.ts'
import { syntenyAdapterTypes } from './adapter-utils.ts'
import { parseJsonFlag } from './validators.ts'

import type { Track } from '../../base.ts'

export function mapLocationForFiles(
  p: string,
  load?: string,
  subDir?: string,
): string {
  return !p || isURL(p) || load === 'inPlace'
    ? p
    : path.join(subDir || '', path.basename(p))
}

export function buildTrackConfig({
  trackType,
  trackId,
  name,
  assemblyNames,
  category,
  description,
  configObj = {},
  adapter,
}: {
  trackType: string
  trackId: string
  name: string
  assemblyNames: string
  category?: string
  description?: string
  configObj?: Record<string, unknown>
  adapter: { type: string; [key: string]: unknown }
}): Track {
  return {
    type: trackType,
    trackId,
    name,
    adapter,
    category: category ? parseCommaSeparatedString(category) : undefined,
    assemblyNames: parseCommaSeparatedString(assemblyNames),
    description,
    ...configObj,
  }
}

// Fold the --color / --height convenience flags and any --displayDefaults JSON
// into one displayDefaults object, layered over a displayDefaults already
// present in --config. Precedence: --config < --displayDefaults < typed flags,
// so the most specific flag a user reaches for wins. Returns undefined when
// nothing was supplied, so the track omits displayDefaults entirely.
//
// Takes `trackType` so it can refuse a key none of that track's displays
// declares. `--color` on an alignments track is the reachable case — that
// display declares `colorBy`, expandTrackConfigShorthand drops the unmatched
// key with a console warning, and the command otherwise wrote the dead setting
// and exited 0.
export function mergeDisplayDefaults({
  configObj,
  color,
  height,
  displayDefaults,
  trackType,
}: {
  configObj?: Record<string, unknown>
  color?: string
  height?: string
  displayDefaults?: string
  trackType: string
}): Record<string, unknown> | undefined {
  const fromJson = displayDefaults
    ? parseJsonFlag(displayDefaults, '--displayDefaults')
    : {}
  const typed: Record<string, unknown> = {}
  if (color !== undefined) {
    typed.color = color
  }
  if (height !== undefined) {
    const asNumber = Number(height)
    typed.height = Number.isNaN(asNumber) ? height : asNumber
  }
  const existing = (configObj?.displayDefaults ?? {}) as Record<string, unknown>
  const merged = { ...existing, ...fromJson, ...typed }
  if (Object.keys(merged).length === 0) {
    return undefined
  }
  checkDisplayDefaultKeys(merged, trackType)
  return merged
}

// An unknown track type accepts everything: it is a plugin's, and this manifest
// is only the core plugins'.
function checkDisplayDefaultKeys(
  merged: Record<string, unknown>,
  trackType: string,
) {
  const accepted = displayDefaultKeysForTrackType(trackType)
  if (accepted.length === 0) {
    return
  }
  const unknown = Object.keys(merged).filter(key => !accepted.includes(key))
  if (unknown.length > 0) {
    throw new Error(
      unknown
        .map(key => {
          const hit = suggest(key, accepted)
          return `no display of a ${trackType} declares "${key}"${hit ? `, did you mean "${hit}"?` : ''}`
        })
        .join('\n'),
    )
  }
}

export function addSyntenyAssemblyNames(
  adapter: { type: string; [key: string]: unknown },
  assemblyNames?: string,
): { type: string; [key: string]: unknown } {
  if (syntenyAdapterTypes.has(adapter.type)) {
    return {
      ...adapter,
      assemblyNames: parseCommaSeparatedString(assemblyNames),
    }
  }
  return adapter
}
