import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import NativeCommand from '../native-base'
import {
  validateLoadOption,
  validateTrackArg,
  validateLoadAndLocation,
  validateAdapterType,
  validateAssemblies,
  validateTrackId,
  createTargetDirectory,
} from './add-track-utils/validators'
import { fileOperation, destinationFn } from './add-track-utils/file-operations'
import {
  guessAdapter,
  guessTrackType,
  guessFileNames,
} from './add-track-utils/adapter-utils'
import {
  mapLocationForFiles,
  buildTrackConfig,
  addSyntenyAssemblyNames,
} from './add-track-utils/track-config'

import type { Config } from '../base'

export default class AddTrackNative extends NativeCommand {
  target = ''

  static description = 'Add a track to a JBrowse 2 configuration'

  static examples = [
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

  async run(args?: string[]) {
    const { values: flags, positionals } = parseArgs({
      args,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        trackType: {
          type: 'string',
          short: 't',
        },
        name: {
          type: 'string',
          short: 'n',
        },
        indexFile: {
          type: 'string',
        },
        description: {
          type: 'string',
          short: 'd',
        },
        assemblyNames: {
          type: 'string',
          short: 'a',
        },
        category: {
          type: 'string',
        },
        config: {
          type: 'string',
        },
        target: {
          type: 'string',
        },
        out: {
          type: 'string',
        },
        subDir: {
          type: 'string',
        },
        trackId: {
          type: 'string',
        },
        load: {
          type: 'string',
          short: 'l',
        },
        skipCheck: {
          type: 'boolean',
          default: false,
        },
        overwrite: {
          type: 'boolean',
          default: false,
        },
        force: {
          type: 'boolean',
          short: 'f',
          default: false,
        },
        protocol: {
          type: 'string',
        },
        bed1: {
          type: 'string',
        },
        bed2: {
          type: 'string',
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
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
      description,
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
    this.target = isDir ? `${output}/config.json` : output

    let { trackType, trackId, name, assemblyNames } = flags

    const configDir = path.dirname(this.target)

    createTargetDirectory(configDir, subDir)
    const location = track

    const mapLoc = (p: string) => mapLocationForFiles(p, load, subDir)

    let adapter = guessAdapter({
      protocol,
      location: mapLoc(location),
      index: index ? mapLoc(index) : undefined,
      bed1: bed1 ? mapLoc(bed1) : undefined,
      bed2: bed2 ? mapLoc(bed2) : undefined,
    })

    adapter = addSyntenyAssemblyNames(adapter, assemblyNames)

    validateLoadAndLocation(location, load)
    validateAdapterType(adapter.type)

    const configContents: Config = await this.readJsonFile(this.target)
    validateAssemblies(configContents, assemblyNames)

    trackType = trackType || guessTrackType(adapter.type)
    trackId = trackId || path.basename(location, path.extname(location))
    name = name || trackId
    assemblyNames = assemblyNames || configContents.assemblies?.[0]?.name || ''

    const trackConfig = buildTrackConfig({
      location,
      trackType,
      trackId,
      name,
      assemblyNames,
      category,
      description,
      config,
      adapter,
      configContents,
      skipCheck,
    })

    const idx = validateTrackId(configContents, trackId, force, overwrite)

    if (idx !== -1) {
      this.debug(`Found existing trackId ${trackId} in configuration`)
      this.debug(`Overwriting track ${trackId} in configuration`)
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

    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, configContents)

    console.log(
      `${
        idx !== -1 ? 'Overwrote' : 'Added'
      } track with name "${name}" and trackId "${trackId}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }

  showHelp() {
    console.log(`
${AddTrackNative.description}

USAGE
  $ jbrowse add-track <track> [options]

ARGUMENTS
  track  Track file or URL

OPTIONS
  -h, --help               Show help
  -t, --trackType <type>   Type of track, by default inferred from track file
  -n, --name <name>        Name of the track. Will be defaulted to the trackId if none specified
  --indexFile <file>       Optional index file for the track
  -d, --description <desc> Optional description of the track
  -a, --assemblyNames <names> Assembly name or names for track as comma separated string
  --category <category>    Optional comma separated string of categories to group tracks
  --config <config>        Any extra config settings to add to a track
  --target <target>        Path to config file in JB2 installation to write out to
  --out <out>              Synonym for target
  --subDir <subDir>        When using --load a file, output to a subdirectory of the target dir
  --trackId <trackId>      trackId for the track, by default inferred from filename
  -l, --load <load>        How to manage the track (copy, symlink, move, inPlace)
  --skipCheck             Skip check for whether file or URL exists
  --overwrite             Overwrites existing track if it shares the same trackId
  -f, --force             Equivalent to --skipCheck --overwrite
  --protocol <protocol>    Force protocol to a specific value
  --bed1 <bed1>           Used only for mcscan anchors/simpleAnchors types
  --bed2 <bed2>           Used only for mcscan anchors/simpleAnchors types

EXAMPLES
${AddTrackNative.examples.join('\n')}
`)
  }
}
