import fs from 'fs'
import path from 'path'

import { supported } from '../../types/common.ts'

import type { Config, Track } from '../../base.ts'

/**
 * Parses a comma-separated string into an array of trimmed, non-empty strings
 */
export function parseCommaSeparatedString(value?: string): string[] {
  return (
    value
      ?.split(',')
      .map(s => s.trim())
      .filter(Boolean) ?? []
  )
}

/**
 * Sanitizes a name for use in file paths by replacing invalid characters
 * Replaces characters that are problematic in file paths: / \ : * ? " < > |
 */
export function sanitizeNameForPath(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_')
}

/**
 * Validates and parses a prefix size value
 */
export function validatePrefixSize(
  value?: string | number,
): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : parseInt(value, 10)
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(
      `Invalid prefixSize: "${value}". Must be a positive number.`,
    )
  }
  return parsed
}

/**
 * Prepares common indexDriver parameters from raw flag values
 */
export function prepareIndexDriverFlags(flags: {
  attributes: string
  exclude: string
  quiet?: boolean
  prefixSize?: string | number
}) {
  return {
    attributes: parseCommaSeparatedString(flags.attributes),
    typesToExclude: parseCommaSeparatedString(flags.exclude),
    quiet: flags.quiet ?? false,
    prefixSize: validatePrefixSize(flags.prefixSize),
  }
}

export function readConf(configPath: string): Config {
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Config
}

export function writeConf(obj: Config, configPath: string): void {
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2))
}

/**
 * Loads config and prepares output location for indexing
 */
export async function loadConfigForIndexing(
  target: string | undefined,
  out: string | undefined,
  resolveConfigPath: (
    target: string | undefined,
    out: string | undefined,
  ) => Promise<string>,
) {
  const configPath = await resolveConfigPath(target, out)
  const outLocation = path.dirname(configPath)
  const config = readConf(configPath)
  ensureTrixDir(outLocation)
  return { config, configPath, outLocation }
}

export function ensureTrixDir(outLocation: string): string {
  const trixDir = path.join(outLocation, 'trix')
  if (!fs.existsSync(trixDir)) {
    fs.mkdirSync(trixDir)
  }
  return trixDir
}

/**
 * Extracts all assembly names from a config object
 * Handles both single assembly (config.assembly) and multiple assemblies (config.assemblies)
 */
function extractAssemblyNamesFromConfig(config: Config): string[] {
  if (config.assemblies) {
    return config.assemblies.map(a => a.name)
  }
  if (config.assembly) {
    return [config.assembly.name]
  }
  return []
}

export function getAssemblyNames(
  config: Config,
  assemblies?: string,
): string[] {
  const asms = assemblies
    ? parseCommaSeparatedString(assemblies)
    : extractAssemblyNamesFromConfig(config)

  if (!asms.length) {
    throw new Error('No assemblies found')
  }

  return asms
}

export function getTrackConfigs(
  config: Config,
  trackIds?: string[],
  assemblyName?: string,
  excludeTrackIds?: string[],
): Track[] {
  const { tracks } = config
  if (!tracks) {
    return []
  }
  const trackIdsToIndex = trackIds || tracks.map(track => track.trackId)
  const excludeSet = new Set(excludeTrackIds || [])

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
    .filter(track => {
      if (excludeSet.has(track.trackId)) {
        console.log(`Skipping ${track.trackId}: excluded via --exclude-tracks`)
        return false
      }
      if (!supported(track.adapter?.type)) {
        console.log(
          `Skipping ${track.trackId}: unsupported adapter type '${track.adapter?.type}'`,
        )
        return false
      }
      if (assemblyName && !track.assemblyNames.includes(assemblyName)) {
        console.log(
          `Skipping ${track.trackId}: not in assembly '${assemblyName}'`,
        )
        return false
      }
      return true
    })
}
