import fs from 'fs'
import path from 'path'

import type { Config } from '../../base'

const isUrl = (loc?: string) => loc?.match(/^https?:\/\//)

export function validateLoadOption(load?: string): void {
  if (load && !['copy', 'symlink', 'move', 'inPlace'].includes(load)) {
    console.error('Error: --load must be one of: copy, symlink, move, inPlace')
    process.exit(1)
  }
}

export function validateTrackArg(track?: string): void {
  if (!track) {
    console.error('Missing 1 required arg:')
    console.error('track  Track file or URL')
    console.error('See more help with --help')
    process.exit(1)
  }
}

export function validateLoadAndLocation(location: string, load?: string): void {
  if (isUrl(location) && load) {
    console.error(
      'Error: The --load flag is used for local files only, but a URL was provided',
    )
    process.exit(100)
  } else if (!isUrl(location) && !load) {
    console.error(
      `Error: The --load flag should be used if a local file is used, example --load
        copy to copy the file into the config directory. Options for load are
        copy/move/symlink/inPlace (inPlace for no file operations)`,
    )
    process.exit(110)
  }
}

export function validateAdapterType(adapterType: string): void {
  if (adapterType === 'UNKNOWN') {
    console.error('Error: Track type is not recognized')
    process.exit(120)
  }
  if (adapterType === 'UNSUPPORTED') {
    console.error('Error: Track type is not supported')
    process.exit(130)
  }
}

export function validateAssemblies(
  configContents: Config,
  assemblyNames?: string,
): void {
  if (!configContents.assemblies?.length) {
    console.error(
      'Error: No assemblies found. Please add one before adding tracks',
    )
    process.exit(150)
  }
  if (configContents.assemblies.length > 1 && !assemblyNames) {
    console.error(
      'Error: Too many assemblies, cannot default to one. Please specify the assembly with the --assemblyNames flag',
    )
    process.exit(1)
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
    console.error(
      `Error: Cannot add track with id ${trackId}, a track with that id already exists (use --force to override)`,
    )
    process.exit(160)
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

export { isUrl }
