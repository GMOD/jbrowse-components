import { isURL } from '../../types/common.ts'

import type { Config } from '../../base.ts'

export function parseConfigFlag(config: string): Record<string, unknown> {
  try {
    return JSON.parse(config) as Record<string, unknown>
  } catch {
    throw new Error(`--config is not valid JSON: ${config}`)
  }
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
