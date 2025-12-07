import path from 'path'

import { createTrixAdapter } from './adapter-utils'
import {
  ensureTrixDir,
  getTrackConfigs,
  readConf,
  writeConf,
} from './config-utils'
import { indexDriver } from './indexing-utils'
import { validateAssembliesForPerTrack } from './validators'
import { resolveConfigPath } from '../../utils'

export async function perTrackIndex(flags: any) {
  const {
    out,
    target,
    tracks,
    assemblies,
    attributes,
    quiet,
    force,
    exclude,
    prefixSize,
  } = flags
  const confFilePath = await resolveConfigPath(target, out)
  const outLocation = path.dirname(confFilePath)
  const config = readConf(confFilePath)
  const configTracks = config.tracks || []
  ensureTrixDir(outLocation)
  validateAssembliesForPerTrack(assemblies)
  const confs = getTrackConfigs(confFilePath, tracks?.split(','))
  if (!confs.length) {
    throw new Error(
      'Tracks not found in config.json, please add track configurations before indexing.',
    )
  }
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
      attributes: attributes.split(','),
      outLocation,
      quiet,
      name: trackId,
      typesToExclude: exclude.split(','),
      assemblyNames,
      prefixSize,
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
      } else {
        console.warn(`Warning: can't find trackId ${trackId}`)
      }
    }
    writeConf({ ...config, tracks: configTracks }, confFilePath)
  }
}
