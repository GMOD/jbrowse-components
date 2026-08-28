import path from 'node:path'

import { supported } from '../../types/common.ts'
import {
  parseCommaSeparatedString,
  readConfigFile,
  resolveConfigPath,
} from '../../utils.ts'

import type { Config, Track } from '../../base.ts'

function validatePrefixSize(value?: string | number): number | undefined {
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
  include?: string
  quiet?: boolean
  prefixSize?: string | number
}) {
  return {
    attributes: parseCommaSeparatedString(flags.attributes),
    typesToExclude: parseCommaSeparatedString(flags.exclude),
    // undefined rather than [] when the flag is absent, because an empty allow
    // list has to mean "no allow list" and not "index nothing"
    typesToInclude: flags.include
      ? parseCommaSeparatedString(flags.include)
      : undefined,
    quiet: flags.quiet ?? false,
    prefixSize: validatePrefixSize(flags.prefixSize),
  }
}

export async function loadConfigForIndexing(
  target: string | undefined,
  out: string | undefined,
) {
  const configPath = await resolveConfigPath(target, out)
  // readConfigFile, not a bare readFileSync: run from the wrong directory, this
  // is the error the user sees, and it should name the config.json it looked for
  const config = await readConfigFile<Config>(configPath)
  return { config, configPath, outLocation: path.dirname(configPath) }
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

// why a track was left out, or undefined if it is indexable
function skipReason(
  track: Track,
  assemblyName: string | undefined,
  excludeSet: Set<string>,
) {
  if (assemblyName && !track.assemblyNames.includes(assemblyName)) {
    return `not in assembly '${assemblyName}'`
  } else if (excludeSet.has(track.trackId)) {
    return 'excluded with --excludeTracks'
  } else if (track.metadata?.skipTextIndex) {
    return 'metadata.skipTextIndex is set'
  } else if (!supported(track.adapter?.type)) {
    return `adapter type ${track.adapter?.type} is not indexable`
  } else {
    return undefined
  }
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
    const reason = skipReason(track, assemblyName, excludeSet)
    // only narrate skips for tracks the user named: sweeping a multi-assembly
    // config otherwise prints a line per track per assembly
    if (reason && trackIds?.length) {
      console.log(`Skipping ${track.trackId}: ${reason}`)
    }
    return !reason
  })
}

export { sanitizeForFilename as sanitizeNameForPath } from '@jbrowse/text-indexing-core'
