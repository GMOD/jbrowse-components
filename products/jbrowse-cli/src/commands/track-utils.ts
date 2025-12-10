import path from 'path'

import { debug, readJsonFile, writeJsonFile } from '../utils'
import { guessFileNames, guessTrackType } from './add-track-utils/adapter-utils'
import { loadFile } from './add-track-utils/file-operations'
import { buildTrackConfig } from './add-track-utils/track-config'
import { validateTrackId } from './add-track-utils/validators'

import type { Config } from '../base'

export async function loadTrackConfig(
  targetConfigPath: string,
): Promise<Config> {
  return await readJsonFile(targetConfigPath)
}

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
  trackConfig: any
  trackId: string
  force: boolean | undefined
  overwrite: boolean | undefined
}): { updatedConfig: Config; wasOverwritten: boolean } {
  const idx = validateTrackId(configContents, trackId, force, overwrite)
  const updatedConfig = { ...configContents }

  if (idx !== -1) {
    debug(`Found existing trackId ${trackId} in configuration`)
    debug(`Overwriting track ${trackId} in configuration`)
    updatedConfig.tracks![idx] = trackConfig
    return { updatedConfig, wasOverwritten: true }
  } else {
    updatedConfig.tracks!.push(trackConfig)
    return { updatedConfig, wasOverwritten: false }
  }
}

export async function saveTrackConfigAndReport({
  config,
  targetConfigPath,
  name,
  trackId,
  wasOverwritten,
}: {
  config: Config
  targetConfigPath: string
  name: string
  trackId: string
  wasOverwritten: boolean
}): Promise<void> {
  debug(`Writing configuration to file ${targetConfigPath}`)
  await writeJsonFile(targetConfigPath, config)

  console.log(
    `${wasOverwritten ? 'Overwrote' : 'Added'} track with name "${name}" and trackId "${trackId}" ${
      wasOverwritten ? 'in' : 'to'
    } ${targetConfigPath}`,
  )
}

export function buildTrackParams({
  flags,
  location,
  adapter,
  configContents,
}: {
  flags: any
  location: string
  adapter: any
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

export function createTrackConfiguration({
  location,
  trackParams,
  flags,
  adapter,
  configContents,
}: {
  location: string
  trackParams: ReturnType<typeof buildTrackParams>
  flags: any
  adapter: any
  configContents: Config
}) {
  return buildTrackConfig({
    location,
    trackType: trackParams.trackType,
    trackId: trackParams.trackId,
    name: trackParams.name,
    assemblyNames: trackParams.assemblyNames,
    category: flags.category,
    description: flags.description,
    config: flags.config,
    adapter,
    configContents,
  })
}
