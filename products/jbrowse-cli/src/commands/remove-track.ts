import { parseArgs } from 'node:util'

import {
  printHelp,
  readJsonFile,
  requirePositional,
  resolveConfigPath,
  writeJsonFile,
} from '../utils.ts'

import type { Config } from '../base.ts'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    target: {
      type: 'string',
      description:
        'Path to config file in JB2 installation directory to write out to',
    },
    out: {
      type: 'string',
      description: 'Synonym for target',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description =
    'Remove a track configuration from a JBrowse 2 configuration. Be aware that this can cause crashes in saved sessions that refer to this track!'

  const usage = 'jbrowse remove-track <trackId> [options]'

  const examples = [
    '# remove a track from the config.json in the current directory',
    '$ jbrowse remove-track my_track_id',
    '',
    '# remove a track from a config.json in a specific installation directory',
    '$ jbrowse remove-track my_track_id --out /path/to/jb2/',
    '',
    '# remove a track from a specific config file',
    '$ jbrowse remove-track my_track_id --target /path/to/jb2/config.json',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage,
      options,
    })
    return
  }

  const trackId = positionals[0]
  requirePositional(trackId, 'trackId', usage)

  const target = await resolveConfigPath(flags.target, flags.out)

  const config: Config = await readJsonFile(target)

  const trackExists = config.tracks?.some(({ trackId: id }) => id === trackId)
  config.tracks = config.tracks?.filter(({ trackId: id }) => id !== trackId)

  if (!trackExists) {
    console.log(`No track found with trackId: ${trackId}`)
  } else {
    await writeJsonFile(target, config)
    console.log(`Removed track with trackId: ${trackId} from ${target}`)
  }
}
