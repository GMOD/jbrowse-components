import path from 'path'

import {
  guessFileNames,
  guessTrackType,
} from './add-track-utils/adapter-utils.ts'
import { loadFile } from './add-track-utils/file-operations.ts'
import { validateTrackId } from './add-track-utils/validators.ts'
import { findAndUpdateOrAdd } from './shared/config-operations.ts'

import type { Config, Track } from '../base.ts'

export async function processTrackFiles({
  location,
  index,
  bed1,
  bed2,
  load,
  configDir,
  subDir,
  force,
}: {
  location: string
  index: string | undefined
  bed1: string | undefined
  bed2: string | undefined
  load: string | undefined
  configDir: string
  subDir: string
  force: boolean | undefined
}): Promise<void> {
  if (load) {
    await Promise.all(
      Object.values(guessFileNames({ location, index, bed1, bed2 }))
        .filter(f => !!f)
        .map(src =>
          loadFile({
            src,
            destDir: configDir,
            mode: load,
            subDir,
            force,
          }),
        ),
    )
  }
}

export function addTrackToConfig({
  configContents,
  trackConfig,
  trackId,
  force,
  overwrite,
}: {
  configContents: Config
  trackConfig: Track
  trackId: string
  force: boolean | undefined
  overwrite: boolean | undefined
}): { updatedConfig: Config; wasOverwritten: boolean } {
  validateTrackId(configContents, trackId, force, overwrite)

  const { updatedItems, wasOverwritten } = findAndUpdateOrAdd({
    items: configContents.tracks ?? [],
    newItem: trackConfig,
    idField: 'trackId',
    getId: item => item.trackId,
    allowOverwrite: force ?? overwrite ?? false,
    itemType: 'track',
  })

  return {
    updatedConfig: { ...configContents, tracks: updatedItems },
    wasOverwritten,
  }
}

export function buildTrackParams({
  flags,
  location,
  adapter,
  configContents,
}: {
  flags: {
    trackType?: string
    trackId?: string
    name?: string
    assemblyNames?: string
  }
  location: string
  adapter: { type: string; [key: string]: unknown }
  configContents: Config
}) {
  const trackType = flags.trackType || guessTrackType(adapter.type)
  const trackId =
    flags.trackId || path.basename(location, path.extname(location))
  const name = flags.name || trackId
  const assemblyNames =
    flags.assemblyNames || configContents.assemblies?.[0]?.name || ''

  return {
    trackType,
    trackId,
    name,
    assemblyNames,
  }
}
