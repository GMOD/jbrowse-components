import { parseArgs } from 'node:util'

import {
  debug,
  isRecord,
  printHelp,
  readInlineOrFileJson,
  readConfigFile,
  requirePositional,
  resolveConfigPath,
} from '../utils.ts'
import {
  findAndUpdateOrAdd,
  saveConfigAndReport,
} from './shared/config-operations.ts'

import type { Config } from '../base.ts'

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

  const notes =
    'The track argument is a JSON file, inline JSON, or "-" to read the JSON ' +
    'from stdin, so a track config can be generated and piped straight in.'

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
    '# pipe the track config in from another program',
    `$ jq '.tracks[0]' other/config.json | jbrowse add-track-json -`,
    '',
    '# write to a config.json in a specific installation directory',
    '$ jbrowse add-track-json track.json --out /path/to/jb2/',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage,
      options,
    })
    return
  }

  const track = positionals[0]
  requirePositional(track, 'track', usage)

  const target = await resolveConfigPath(flags.target, flags.out)

  const { update } = flags
  const config: Config = await readConfigFile(target)
  debug(`Found existing config file ${target}`)

  const parsed: unknown = await readInlineOrFileJson(track)
  if (isRecord(parsed) && typeof parsed.trackId === 'string') {
    const trackConfig = { ...parsed, trackId: parsed.trackId }
    const { updatedItems, wasOverwritten } = findAndUpdateOrAdd({
      items: config.tracks ?? [],
      newItem: trackConfig,
      idField: 'trackId',
      getId: item => item.trackId,
      force: update ?? false,
      itemType: 'track',
    })

    await saveConfigAndReport({
      config: { ...config, tracks: updatedItems },
      target,
      itemType: 'track',
      itemName:
        typeof trackConfig.name === 'string'
          ? trackConfig.name
          : trackConfig.trackId,
      itemId: trackConfig.trackId,
      wasOverwritten,
    })
  } else {
    throw new Error(
      'The track JSON must be an object with a string "trackId", e.g. {"trackId":"genes", ...}',
    )
  }
}
