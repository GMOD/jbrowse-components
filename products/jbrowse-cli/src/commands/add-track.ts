import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import { debug, printHelp, readJsonFile, writeJsonFile } from '../utils'
import {
  guessAdapter,
  guessFileNames,
  guessTrackType,
} from './add-track-utils/adapter-utils'
import { destinationFn, fileOperation } from './add-track-utils/file-operations'
import {
  addSyntenyAssemblyNames,
  buildTrackConfig,
  mapLocationForFiles,
} from './add-track-utils/track-config'
import {
  createTargetDirectory,
  validateAdapterType,
  validateAssemblies,
  validateLoadAndLocation,
  validateLoadOption,
  validateTrackArg,
  validateTrackId,
} from './add-track-utils/validators'

import type { Config } from '../base'

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
      description: 'Assembly name or names for track as comma separated string',
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
    skipCheck: {
      type: 'boolean',
      description: 'Skip check for whether file or URL exists',
    },
    overwrite: {
      type: 'boolean',
      description: 'Overwrites existing track if it shares the same trackId',
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Equivalent to --skipCheck --overwrite',
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
    skipCheck,
    force,
    overwrite,
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
  } = flags

  const output = target || out || '.'
  const isDir = fs.lstatSync(output).isDirectory()
  const targetConfigPath = isDir ? `${output}/config.json` : output

  const configDir = path.dirname(targetConfigPath)

  createTargetDirectory(configDir, subDir)
  const location = track!

  const mapLoc = (p: string) => mapLocationForFiles(p, load, subDir)

  let adapter = guessAdapter({
    protocol,
    location: mapLoc(location),
    index: index ? mapLoc(index) : undefined,
    bed1: bed1 ? mapLoc(bed1) : undefined,
    bed2: bed2 ? mapLoc(bed2) : undefined,
  })

  adapter = addSyntenyAssemblyNames(adapter, flags.assemblyNames)

  validateLoadAndLocation(location, load)
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
    location,
    trackType,
    trackId,
    name,
    assemblyNames,
    category,
    description: trackDescription,
    config,
    adapter,
    configContents,
    skipCheck,
  })

  const idx = validateTrackId(configContents, trackId, force, overwrite)

  if (idx !== -1) {
    debug(`Found existing trackId ${trackId} in configuration`)
    debug(`Overwriting track ${trackId} in configuration`)
    configContents.tracks![idx] = trackConfig
  } else {
    configContents.tracks!.push(trackConfig)
  }

  if (load && load !== 'inPlace') {
    await Promise.all(
      Object.values(guessFileNames({ location, index, bed1, bed2 }))
        .filter(f => !!f)
        .map(srcFilename =>
          fileOperation({
            mode: load,
            srcFilename,
            destFilename: destinationFn({
              destinationDir: configDir,
              srcFilename,
              force,
              subDir,
            }),
          }),
        ),
    )
  }

  debug(`Writing configuration to file ${targetConfigPath}`)
  await writeJsonFile(targetConfigPath, configContents)

  console.log(
    `${idx !== -1 ? 'Overwrote' : 'Added'} track with name "${name}" and trackId "${trackId}" ${
      idx !== -1 ? 'in' : 'to'
    } ${targetConfigPath}`,
  )
}
