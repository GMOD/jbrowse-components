import path from 'path'

import parseJSON from 'json-parse-better-errors'

import { isURL } from '../../types/common.ts'

import type { Track } from '../../base.ts'

const SYNTENY_ADAPTERS = new Set([
  'PAFAdapter',
  'PairwiseIndexedPAFAdapter',
  'DeltaAdapter',
  'ChainAdapter',
  'MashMapAdapter',
  'MCScanAnchorsAdapter',
  'MCScanSimpleAnchorsAdapter',
])

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
  config,
  adapter,
}: {
  trackType: string
  trackId: string
  name: string
  assemblyNames: string
  category?: string
  description?: string
  config?: string
  adapter: { type: string; [key: string]: unknown }
}): Track {
  const configObj = config ? parseJSON(config) : {}
  return {
    type: trackType,
    trackId,
    name,
    adapter,
    category: category?.split(',').map(c => c.trim()),
    assemblyNames: assemblyNames.split(',').map(a => a.trim()),
    description,
    ...configObj,
  }
}

export function addSyntenyAssemblyNames(
  adapter: { type: string; [key: string]: unknown },
  assemblyNames?: string,
): { type: string; [key: string]: unknown } {
  if (SYNTENY_ADAPTERS.has(adapter.type)) {
    return {
      ...adapter,
      assemblyNames: assemblyNames?.split(',').map(a => a.trim()),
    }
  }
  return adapter
}
