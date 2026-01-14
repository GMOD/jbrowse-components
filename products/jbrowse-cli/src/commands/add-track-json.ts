import { parseArgs } from 'util'

import {
  debug,
  printHelp,
  readInlineOrFileJson,
  readJsonFile,
  resolveConfigPath,
} from '../utils.ts'
import {
  findAndUpdateOrAdd,
  saveConfigAndReport,
} from './shared/config-operations.ts'

import type { Config, Track } from '../base.ts'

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
    throw new Error(
      'Missing required argument: track\nUsage: jbrowse add-track-json <track> [options]',
    )
  }

  const target = await resolveConfigPath(flags.target, flags.out)

  debug(`Sequence location is: ${track}`)
  const { update } = flags
  const config: Config = await readJsonFile(target)
  debug(`Found existing config file ${target}`)

  const trackConfig = await readInlineOrFileJson<Track>(track)
  if (!config.tracks) {
    config.tracks = []
  }

  const { updatedItems, wasOverwritten } = findAndUpdateOrAdd({
    items: config.tracks,
    newItem: trackConfig,
    idField: 'trackId',
    getId: item => item.trackId,
    allowOverwrite: update ?? false,
    itemType: 'track',
  })

  config.tracks = updatedItems

  await saveConfigAndReport({
    config,
    target,
    itemType: 'track',
    itemName: trackConfig.name,
    itemId: trackConfig.trackId,
    wasOverwritten,
  })
}
