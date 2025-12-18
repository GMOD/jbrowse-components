import fs from 'fs'
import path from 'path'

import { supported } from '../../types/common'

import type { Config, Track } from '../../base'

export function readConf(configPath: string): Config {
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Config
}

export function writeConf(obj: Config, configPath: string): void {
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2))
}

export function ensureTrixDir(outLocation: string): string {
  const trixDir = path.join(outLocation, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  return trixDir
}

export function getAssemblyNames(
  config: Config,
  assemblies?: string,
): string[] {
  const asms =
    assemblies?.split(',') ||
    config.assemblies?.map(a => a.name) ||
    (config.assembly ? [config.assembly.name] : [])

  if (!asms.length) {
    throw new Error('No assemblies found')
  }

  return asms
}

export function getTrackConfigs(
  config: Config,
  trackIds?: string[],
  assemblyName?: string,
): Track[] {
  const { tracks } = config
  if (!tracks) {
    return []
  }
  const trackIdsToIndex = trackIds || tracks.map(track => track.trackId)
  return trackIdsToIndex
    .map(trackId => {
      const currentTrack = tracks.find(t => trackId === t.trackId)
      if (!currentTrack) {
        throw new Error(
          `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
        )
      }
      return currentTrack
    })
    .filter(track => supported(track.adapter?.type))
    .filter(track =>
      assemblyName ? track.assemblyNames.includes(assemblyName) : true,
    )
}
