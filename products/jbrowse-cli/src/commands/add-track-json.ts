import { parseArgs } from 'node:util'

import {
  debug,
  printHelp,
  readInlineOrFileJson,
  readJsonFile,
  requirePositional,
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

  const usage = 'jbrowse add-track-json <track> [options]'

  const examples = [
    '# add a track from a JSON file',
    '$ jbrowse add-track-json track.json',
    '',
    '# update an existing track (matched by trackId) with new JSON contents',
    '$ jbrowse add-track-json track.json --update',
    '',
    '# pass the track config inline instead of via a file',
    `$ jbrowse add-track-json '{"type":"FeatureTrack","trackId":"genes","assemblyNames":["hg38"],"adapter":{"type":"Gff3TabixAdapter","gffGzLocation":{"uri":"genes.gff.gz"}}}'`,
    '',
    '# write to a config.json in a specific installation directory',
    '$ jbrowse add-track-json track.json --out /path/to/jb2/',
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

  const track = positionals[0]
  requirePositional(track, 'track', usage)

  const target = await resolveConfigPath(flags.target, flags.out)

  debug(`Sequence location is: ${track}`)
  const { update } = flags
  const config: Config = await readJsonFile(target)
  debug(`Found existing config file ${target}`)

  const trackConfig = await readInlineOrFileJson<Track>(track)
  config.tracks ??= []

  const { updatedItems, wasOverwritten } = findAndUpdateOrAdd({
    items: config.tracks,
    newItem: trackConfig,
    idField: 'trackId',
    getId: item => item.trackId,
    force: update ?? false,
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
