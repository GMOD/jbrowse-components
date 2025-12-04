import fs from 'fs'
import path from 'path'

import { createPerTrackTrixAdapter } from './adapter-utils'
import { getTrackConfigs, readConf, writeConf } from './config-utils'
import { indexDriver } from './indexing-utils'
import { validateAssembliesForPerTrack } from './validators'

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
  const outFlag = target || out || '.'

  const isDir = fs.lstatSync(outFlag).isDirectory()
  const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
  const outLocation = path.dirname(confFilePath)
  const config = readConf(confFilePath)
  const configTracks = config.tracks || []
  const trixDir = path.join(outLocation, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
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
            textSearchAdapter: createPerTrackTrixAdapter(
              trackId,
              assemblyNames,
            ),
          },
        }
      } else {
        console.log("Error: can't find trackId")
      }
    }
    writeConf({ ...config, tracks: configTracks }, confFilePath)
  }
}
