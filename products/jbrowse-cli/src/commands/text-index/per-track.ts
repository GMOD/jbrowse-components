import { createTrixAdapter } from './adapter-utils.ts'
import {
  formatDryRun,
  getTrackConfigs,
  loadConfigForIndexing,
  parseCommaSeparatedString,
  prepareIndexDriverFlags,
  writeConf,
} from './config-utils.ts'
import { indexDriver } from './indexing-utils.ts'
import {
  validateAssembliesForPerTrack,
  validateTrackConfigs,
} from './validators.ts'
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
    dryrun,
  } = flags
  validateAssembliesForPerTrack(assemblies)
  const { config, configPath, outLocation } = await loadConfigForIndexing(
    target,
    out,
    resolveConfigPath,
  )
  const configTracks = config.tracks ?? []
  const confs = getTrackConfigs(
    config,
    parseCommaSeparatedString(tracks),
    undefined,
    parseCommaSeparatedString(excludeTracks),
  )
  validateTrackConfigs(confs)
  if (dryrun) {
    console.log(formatDryRun(confs))
  } else {
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
}
