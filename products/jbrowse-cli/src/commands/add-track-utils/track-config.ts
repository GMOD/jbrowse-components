import path from 'path'

import parseJSON from 'json-parse-better-errors'

import { isURL } from '../../types/common'

import type { Config, Track } from '../../base'

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
  location,
  trackType,
  trackId,
  name,
  assemblyNames,
  category,
  description,
  config,
  adapter,
  configContents,
  skipCheck,
}: {
  location: string
  trackType?: string
  trackId?: string
  name?: string
  assemblyNames?: string
  category?: string
  description?: string
  config?: string
  adapter: any
  configContents: Config
  skipCheck?: boolean
}): Track {
  const configObj = config ? parseJSON(config) : {}

  const finalTrackId =
    trackId || path.basename(location, path.extname(location))
  const finalName = name || finalTrackId
  const finalAssemblyNames =
    assemblyNames || configContents.assemblies?.[0]?.name || ''

  const trackConfig: Track = {
    type: trackType!,
    trackId: finalTrackId,
    name: finalName,
    adapter,
    category: category?.split(',').map(c => c.trim()),
    assemblyNames: finalAssemblyNames.split(',').map(a => a.trim()),
    description,
    ...configObj,
  }

  return trackConfig
}

export function addSyntenyAssemblyNames(
  adapter: any,
  assemblyNames?: string,
): any {
  if (SYNTENY_ADAPTERS.has(adapter.type)) {
    return {
      ...adapter,
      assemblyNames: assemblyNames?.split(',').map(a => a.trim()),
    }
  }
  return adapter
}
