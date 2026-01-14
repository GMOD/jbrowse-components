import { createTrixAdapter } from './adapter-utils.ts'
import {
  getTrackConfigs,
  loadConfigForIndexing,
  parseCommaSeparatedString,
  prepareIndexDriverFlags,
  writeConf,
} from './config-utils.ts'
import { indexDriver } from './indexing-utils.ts'
import { validateAssembliesForPerTrack } from './validators.ts'
import { resolveConfigPath } from '../../utils.ts'

import type { TextIndexFlags } from './index.ts'

export async function perTrackIndex(flags: TextIndexFlags): Promise<void> {
  const {
    out,
    target,
    tracks,
    excludeTracks,
    assemblies,
    attributes,
    quiet,
    force,
    exclude,
    prefixSize,
  } = flags
  const { config, configPath, outLocation } = await loadConfigForIndexing(
    target,
    out,
    resolveConfigPath,
  )
  const configTracks = config.tracks || []
  validateAssembliesForPerTrack(assemblies)
  const confs = getTrackConfigs(
    config,
    parseCommaSeparatedString(tracks),
    undefined,
    parseCommaSeparatedString(excludeTracks),
  )
  if (!confs.length) {
    throw new Error(
      'Tracks not found in config.json, please add track configurations before indexing.',
    )
  }
  let hasChanges = false
  for (const trackConfig of confs) {
    const { textSearching, trackId, assemblyNames } = trackConfig
    if (textSearching?.textSearchAdapter && !force) {
      console.log(
        `Note: ${trackId} has already been indexed with this configuration, use --force to overwrite this track. Skipping for now`,
      )
      continue
    }
    console.log(`Indexing track ${trackId}...`)

    await indexDriver({
      trackConfigs: [trackConfig],
      outLocation,
      name: trackId,
      assemblyNames,
      ...prepareIndexDriverFlags({ attributes, exclude, quiet, prefixSize }),
    })
    if (!textSearching?.textSearchAdapter) {
      // modifies track with new text search adapter
      const index = configTracks.findIndex(track => trackId === track.trackId)
      if (index !== -1) {
        configTracks[index] = {
          ...trackConfig,
          textSearching: {
            ...textSearching,
            textSearchAdapter: createTrixAdapter(trackId, assemblyNames),
          },
        }
        hasChanges = true
      } else {
        console.warn(`Warning: can't find trackId ${trackId}`)
      }
    }
  }

  if (hasChanges) {
    writeConf({ ...config, tracks: configTracks }, configPath)
  }
}
