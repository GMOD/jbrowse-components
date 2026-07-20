import path from 'node:path'

import { isURL } from '../../types/common.ts'
import { parseCommaSeparatedString } from '../../utils.ts'
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
export function mergeDisplayDefaults({
  configObj,
  color,
  height,
  displayDefaults,
}: {
  configObj?: Record<string, unknown>
  color?: string
  height?: string
  displayDefaults?: string
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
  return Object.keys(merged).length > 0 ? merged : undefined
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
