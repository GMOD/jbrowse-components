import { promises as fsPromises } from 'fs'
import { parseArgs } from 'util'

import {
  debug,
  printHelp,
  readInlineOrFileJson,
  readJsonFile,
  writeJsonFile,
} from '../utils'

import type { Config, Track } from '../base'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    update: {
      type: 'boolean',
      short: 'u',
      description:
        'Update the contents of an existing track, matched based on trackId',
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
    'Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration'

  const examples = [
    '$ jbrowse add-track-json track.json',
    '$ jbrowse add-track-json track.json --update',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse add-track-json <track> [options]',
      options,
    })
    return
  }

  const track = positionals[0]
  if (!track) {
    console.error('Error: Missing required argument: track')
    console.error('Usage: jbrowse add-track-json <track> [options]')
    process.exit(1)
  }

  const output = flags.target || flags.out || '.'
  const isDir = (await fsPromises.lstat(output)).isDirectory()
  const target = isDir ? `${output}/config.json` : output

  debug(`Sequence location is: ${track}`)
  const { update } = flags
  const config: Config = await readJsonFile(target)
  debug(`Found existing config file ${target}`)

  const trackConfig = await readInlineOrFileJson<Track>(track)
  if (!config.tracks) {
    config.tracks = []
  }
  const idx = config.tracks.findIndex(
    ({ trackId }: { trackId: string }) => trackId === trackConfig.trackId,
  )
  if (idx !== -1) {
    const existing = config.tracks[idx]?.name
    debug(`Found existing track ${existing} in configuration`)
    if (update) {
      debug(`Overwriting track ${existing} in configuration`)
      config.tracks[idx] = trackConfig
    } else {
      console.error(
        `Error: Cannot add track ${trackConfig.name}, a track with that trackId already exists: ${existing}`,
      )
      process.exit(160)
    }
  } else {
    config.tracks.push(trackConfig)
  }
  debug(`Writing configuration to file ${target}`)
  await writeJsonFile(target, config)
  console.log(
    `${idx !== -1 ? 'Overwrote' : 'Added'} track "${trackConfig.name}" ${
      idx !== -1 ? 'in' : 'to'
    } ${target}`,
  )
}
