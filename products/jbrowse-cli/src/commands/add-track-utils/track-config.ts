import path from 'node:path'

import { syntenyAdapterTypes } from './adapter-utils.ts'
import { isURL } from '../../types/common.ts'
import { parseCommaSeparatedString } from '../../utils.ts'

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
