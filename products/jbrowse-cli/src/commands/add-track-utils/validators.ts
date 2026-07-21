import { isURL } from '../../types/common.ts'
import { parseCommaSeparatedString } from '../../utils.ts'

import type { Config } from '../../base.ts'

export function parseJsonFlag(
  value: string,
  flagName: string,
): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    throw new Error(`${flagName} is not valid JSON: ${value}`)
  }
}

export function parseConfigFlag(config: string): Record<string, unknown> {
  return parseJsonFlag(config, '--config')
}

export function validateLoadOption(load?: string): void {
  if (load && !['copy', 'symlink', 'move', 'inPlace'].includes(load)) {
    throw new Error('--load must be one of: copy, symlink, move, inPlace')
  }
}

export function validateTrackArg(track?: string): asserts track is string {
  if (!track) {
    throw new Error(
      'Missing 1 required arg:\ntrack  Track file or URL\nSee more help with --help',
    )
  }
}

export function validateLoadAndLocation(location: string, load?: string): void {
  if (isURL(location) && load) {
    throw new Error(
      'The --load flag is used for local files only, but a URL was provided',
    )
  } else if (!isURL(location) && !load) {
    throw new Error(
      `The --load flag should be used if a local file is used, example --load
        copy to copy the file into the config directory. Options for load are
        copy/move/symlink/inPlace (inPlace for no file operations)`,
    )
  }
}

// --multiwig follows the same local-file rule as a single track: local sources
// need a --load mode, a pure-URL set must omit it. hasLocalSource is true when
// any comma/JSON string source is a local path.
export function validateMultiWiggleLoad(
  hasLocalSource: boolean,
  load?: string,
): void {
  if (hasLocalSource && !load) {
    throw new Error(
      '--load is required when --multiwig includes local files (copy/move/symlink/inPlace)',
    )
  }
  if (!hasLocalSource && load) {
    throw new Error(
      'The --load flag is used for local files only, but every --multiwig source is a URL',
    )
  }
}

export function validateAdapterType(adapterType: string): void {
  if (adapterType === 'UNKNOWN') {
    throw new Error('Track type is not recognized')
  }
  if (adapterType === 'UNSUPPORTED') {
    throw new Error('Track type is not supported')
  }
}

export function validateAssemblies(
  configContents: Config,
  assemblyNames?: string,
): void {
  if (!configContents.assemblies?.length) {
    throw new Error('No assemblies found. Please add one before adding tracks')
  }
  if (configContents.assemblies.length > 1 && !assemblyNames) {
    throw new Error(
      'Too many assemblies, cannot default to one. Please specify the assembly with the --assemblyNames flag',
    )
  }
}

// warn (don't throw) when a --assemblyNames entry matches no assembly in the
// config: a typo or reversed query,target usually means this, but referencing an
// assembly to be added later is legitimate, so it stays a soft warning
export function warnUnknownAssemblyNames(
  configContents: Config,
  assemblyNames: string,
): void {
  const known = new Set(
    configContents.assemblies?.flatMap(a => [a.name, ...(a.aliases ?? [])]) ??
      [],
  )
  const missing = parseCommaSeparatedString(assemblyNames).filter(
    name => !known.has(name),
  )
  if (missing.length) {
    console.warn(
      `Warning: assembly name(s) not found in config: ${missing.join(', ')}. ` +
        `Available: ${[...known].join(', ')}. ` +
        'Check for a typo or reversed query,target order; the track will not display until a matching assembly exists.',
    )
  }
}
