import fs from 'fs'
import path from 'path'

import { isURL } from '../../types/common.ts'

import type { Config } from '../../base.ts'

export function validateLoadOption(load?: string): void {
  if (load && !['copy', 'symlink', 'move', 'inPlace'].includes(load)) {
    throw new Error(
      'Error: --load must be one of: copy, symlink, move, inPlace',
    )
  }
}

export function validateTrackArg(track?: string): void {
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

export function validateTrackId(
  configContents: Config,
  trackId: string,
  force?: boolean,
  overwrite?: boolean,
): number {
  if (!configContents.tracks) {
    configContents.tracks = []
  }

  const idx = configContents.tracks.findIndex(c => c.trackId === trackId)

  if (idx !== -1 && !force && !overwrite) {
    throw new Error(
      `Cannot add track with id ${trackId}, a track with that id already exists (use --force to override)`,
    )
  }

  return idx
}

export function createTargetDirectory(
  configDir: string,
  subDir?: string,
): void {
  if (subDir) {
    const dir = path.join(configDir, subDir)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
  }
}
