import fs from 'node:fs'
import path from 'node:path'

import { supported } from '../../types/common.ts'
import { parseCommaSeparatedString } from '../../utils.ts'

import type { Config, Track } from '../../base.ts'

export function validatePrefixSize(
  value?: string | number,
): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = typeof value === 'number' ? value : parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid prefixSize: "${value}". Must be a positive number.`,
    )
  }
  return parsed
}

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
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}

export function writeConf(obj: Config, configPath: string): void {
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2))
}

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
    fs.mkdirSync(trixDir, { recursive: true })
  }
  return trixDir
}

export function getAssemblyNames(
  config: Config,
  assemblies?: string,
): string[] {
  const asms = assemblies
    ? parseCommaSeparatedString(assemblies)
    : (config.assemblies?.map(a => a.name) ??
      (config.assembly ? [config.assembly.name] : []))

  if (!asms.length) {
    throw new Error('No assemblies found')
  }

  return asms
}

export function formatDryRun(trackConfigs: Track[]): string {
  return trackConfigs.map(t => `${t.trackId}\t${t.adapter?.type}`).join('\n')
}

export function getTrackConfigs(
  config: Config,
  trackIds?: string[],
  assemblyName?: string,
  excludeTrackIds?: string[],
): Track[] {
  const tracks = config.tracks ?? []

  // when specific trackIds are requested every one must exist; otherwise
  // consider all tracks in the config
  const requested = trackIds?.length
    ? trackIds.map(trackId => {
        const track = tracks.find(t => t.trackId === trackId)
        if (track) {
          return track
        } else {
          throw new Error(
            `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
          )
        }
      })
    : tracks

  const excludeSet = new Set(excludeTrackIds)
  return requested.filter(track => {
    const inAssembly =
      !assemblyName || track.assemblyNames.includes(assemblyName)
    if (!inAssembly) {
      console.log(
        `Skipping ${track.trackId}: not in assembly '${assemblyName}'`,
      )
    }
    return (
      inAssembly &&
      !excludeSet.has(track.trackId) &&
      !track.metadata?.skipTextIndex &&
      supported(track.adapter?.type)
    )
  })
}

export { sanitizeForFilename as sanitizeNameForPath } from '@jbrowse/text-indexing-core'

export { parseCommaSeparatedString } from '../../utils.ts'
