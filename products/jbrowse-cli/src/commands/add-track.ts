import path from 'path'
import { parseArgs } from 'util'

import { printHelp, readJsonFile, resolveConfigPath } from '../utils.ts'
import {
  guessAdapter,
  guessFileNames,
  guessTrackType,
} from './add-track-utils/adapter-utils.ts'
import { loadFiles } from './add-track-utils/file-operations.ts'
import {
  addSyntenyAssemblyNames,
  buildTrackConfig,
  mapLocationForFiles,
} from './add-track-utils/track-config.ts'
import {
  parseConfigFlag,
  validateAdapterType,
  validateAssemblies,
  validateLoadAndLocation,
  validateLoadOption,
  validateTrackArg,
} from './add-track-utils/validators.ts'
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
    trackType: {
      type: 'string',
      short: 't',
      description: 'Type of track, by default inferred from track file',
    },
    adapterType: {
      type: 'string',
      description: 'Adapter type, by default inferred from track file',
    },
    name: {
      type: 'string',
      short: 'n',
      description:
        'Name of the track. Will be defaulted to the trackId if none specified',
    },
    indexFile: {
      type: 'string',
      description: 'Optional index file for the track',
    },
    description: {
      type: 'string',
      short: 'd',
      description: 'Optional description of the track',
    },
    assemblyNames: {
      type: 'string',
      short: 'a',
      description:
        'Assembly name or names for track as comma separated string. For synteny tracks the order is query,target (reverse of minimap2/nucmer argument order)',
    },
    category: {
      type: 'string',
      description:
        'Optional comma separated string of categories to group tracks',
    },
    config: {
      type: 'string',
      description: 'Any extra config settings to add to a track',
    },
    target: {
      type: 'string',
      description: 'Path to config file in JB2 installation to write out to',
    },
    out: {
      type: 'string',
      description: 'Synonym for target',
    },
    subDir: {
      type: 'string',
      description:
        'When using --load a file, output to a subdirectory of the target dir',
    },
    trackId: {
      type: 'string',
      description: 'trackId for the track, by default inferred from filename',
    },
    load: {
      type: 'string',
      short: 'l',
      description: 'How to manage the track (copy, symlink, move, inPlace)',
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Overwrite existing track and any existing files',
    },
    protocol: {
      type: 'string',
      description: 'Force protocol to a specific value',
    },
    bed1: {
      type: 'string',
      description: 'Used only for mcscan anchors/simpleAnchors types',
    },
    bed2: {
      type: 'string',
      description: 'Used only for mcscan anchors/simpleAnchors types',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Add a track to a JBrowse 2 configuration'

  const notes =
    '--load controls how the data file is placed relative to config.json: ' +
    'copy, move, or symlink it into the install directory, or inPlace to ' +
    'reference it where it already sits (use inPlace for URLs or pre-staged ' +
    'files). The matching index (.bai/.csi/.tbi/.fai) is inferred from the ' +
    'data file name; pass --indexFile when it differs.\n\n' +
    '--config takes inline JSON (not a file path) that is merged into the ' +
    'generated track config, so you can set fields the dedicated flags do not ' +
    'cover, e.g. --config \'{"metadata":{"skipTextIndex":true}}\' to exclude ' +
    'the track from jbrowse text-index.\n\n' +
    'For synteny adapters (PAF/Delta/Chain) --assemblyNames is query,target — ' +
    'the reverse of the minimap2/nucmer input order.'

  const examples = [
    '# copy /path/to/my.bam and /path/to/my.bam.bai to current directory and adds track to config.json',
    '$ jbrowse add-track /path/to/my.bam --load copy',
    '',
    '# copy my.bam and my.bam.bai to /path/to/jb2/bam and adds track entry to /path/to/jb2/bam/config.json',
    '$ jbrowse add-track my.bam --load copy --out /path/to/jb2 --subDir bam',
    '',
    '# same as above, but specify path to bai file. needed for if the bai file does not have the extension .bam.bai',
    '$ jbrowse add-track my.bam --indexFile my.bai --load copy',
    '',
    '# creates symlink for /path/to/my.bam and adds track to config.json',
    '$ jbrowse add-track /path/to/my.bam --load symlink',
    '',
    '# add track from URL to config.json, no --load flag needed',
    '$ jbrowse add-track https://mywebsite.com/my.bam',
    '',
    '# --load inPlace adds a track without doing file operations',
    '$ jbrowse add-track /url/relative/path.bam --load inPlace',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse add-track <track> [options]',
      options,
    })
    return
  }

  validateLoadOption(flags.load)

  const track = positionals[0]
  validateTrackArg(track)

  const {
    config,
    force,
    category,
    description: trackDescription,
    load,
    subDir = '',
    target,
    protocol = 'uri',
    out,
    indexFile: index,
    bed1,
    bed2,
    adapterType,
  } = flags

  const location = track!
  validateLoadAndLocation(location, load)

  const configObj = config ? parseConfigFlag(config) : undefined

  const targetConfigPath = await resolveConfigPath(target, out)
  const configDir = path.dirname(targetConfigPath)

  const mapLoc = (p: string) => mapLocationForFiles(p, load, subDir)
  const mapOpt = (p?: string) => (p ? mapLoc(p) : undefined)

  let adapter = guessAdapter({
    protocol,
    location: mapLoc(location),
    index: mapOpt(index),
    bed1: mapOpt(bed1),
    bed2: mapOpt(bed2),
    adapterType,
  })

  adapter = addSyntenyAssemblyNames(adapter, flags.assemblyNames)

  validateAdapterType(adapter.type)

  const configContents: Config = await readJsonFile(targetConfigPath)
  validateAssemblies(configContents, flags.assemblyNames)

  const trackType = flags.trackType || guessTrackType(adapter.type)
  const trackId =
    flags.trackId || path.basename(location, path.extname(location))
  const name = flags.name || trackId
  const assemblyNames =
    flags.assemblyNames || configContents.assemblies?.[0]?.name || ''

  const trackConfig = buildTrackConfig({
    trackType,
    trackId,
    name,
    assemblyNames,
    category,
    description: trackDescription,
    configObj,
    adapter,
  })

  const { updatedItems: tracks, wasOverwritten } = findAndUpdateOrAdd({
    items: configContents.tracks ?? [],
    newItem: trackConfig,
    idField: 'trackId',
    getId: item => item.trackId,
    force: force ?? false,
    itemType: 'track',
  })
  const updatedConfig = { ...configContents, tracks }

  await loadFiles({
    files: guessFileNames({ location, index, bed1, bed2 }),
    destDir: configDir,
    mode: load,
    subDir,
    force,
  })

  await saveConfigAndReport({
    config: updatedConfig,
    target: targetConfigPath,
    itemType: 'track',
    itemName: name,
    itemId: trackId,
    wasOverwritten,
  })
}
