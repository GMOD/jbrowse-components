import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import parseJSON from 'json-parse-better-errors'

import NativeCommand from '../native-base'

import type { Config, Track } from '../base'

const { copyFile, rename, symlink } = fs.promises
const { COPYFILE_EXCL } = fs.constants

function makeLocationProtocol(protocol: string) {
  return (location: string) => {
    if (protocol === 'uri') {
      return {
        uri: location,
        locationType: 'UriLocation',
      } as UriLocation
    }
    if (protocol === 'localPath') {
      return {
        localPath: location,
        locationType: 'LocalPathLocation',
      } as LocalPathLocation
    }
    throw new Error(`invalid protocol ${protocol}`)
  }
}

function fileOperation({
  srcFilename,
  destFilename,
  mode,
}: {
  srcFilename: string
  destFilename: string
  mode: string
}) {
  if (mode === 'copy') {
    return copyFile(srcFilename, destFilename, COPYFILE_EXCL)
  } else if (mode === 'move') {
    return rename(srcFilename, destFilename)
  } else if (mode === 'symlink') {
    return symlink(path.resolve(srcFilename), destFilename)
  }
  return undefined
}

// get path of destination, and remove file at that path if it exists and force
// is set
function destinationFn({
  destinationDir,
  srcFilename,
  subDir,
  force,
}: {
  destinationDir: string
  srcFilename: string
  subDir: string
  force: boolean
}) {
  const dest = path.resolve(
    path.join(destinationDir, subDir, path.basename(srcFilename)),
  )
  if (force) {
    try {
      fs.unlinkSync(dest)
    } catch (e) {
      /* unconditionally unlinkSync, due to
       * https://github.com/nodejs/node/issues/14025#issuecomment-754021370
       * and https://github.com/GMOD/jbrowse-components/issues/2768 */
    }
  }
  return dest
}

interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}

interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}

const isUrl = (loc?: string) => loc?.match(/^https?:\/\//)

export default class AddTrackNative extends NativeCommand {
  target: string = ''

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

  async run() {
    const { values: flags, positionals } = parseArgs({
      args: process.argv.slice(3), // Skip node, script, and command name
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

    // Validate load flag options
    if (flags.load && !['copy', 'symlink', 'move', 'inPlace'].includes(flags.load)) {
      console.error('Error: --load must be one of: copy, symlink, move, inPlace')
      process.exit(1)
    }

    const track = positionals[0]
    if (!track) {
      console.error('Error: Missing required argument: track')
      console.error('Usage: jbrowse add-track <track> [options]')
      process.exit(1)
    }

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

    if (subDir) {
      const dir = path.join(configDir, subDir)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
      }
    }
    const location = track

    const mapLoc = (p: string) => {
      return !p || isUrl(p) || load === 'inPlace'
        ? p
        : path.join(subDir, path.basename(p))
    }

    const adapter = this.guessAdapter({
      protocol,
      location: mapLoc(location),
      index: index ? mapLoc(index) : undefined,
      bed1: bed1 ? mapLoc(bed1) : undefined,
      bed2: bed2 ? mapLoc(bed2) : undefined,
    })

    if (
      [
        'PAFAdapter',
        'PairwiseIndexedPAFAdapter',
        'DeltaAdapter',
        'ChainAdapter',
        'MashMapAdapter',
        'MCScanAnchorsAdapter',
        'MCScanSimpleAnchorsAdapter',
      ].includes(adapter.type)
    ) {
      // @ts-expect-error
      // this is for the adapter's assembly names
      adapter.assemblyNames = assemblyNames?.split(',').map(a => a.trim())
    }

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
    if (adapter.type === 'UNKNOWN') {
      console.error('Error: Track type is not recognized')
      process.exit(120)
    }
    if (adapter.type === 'UNSUPPORTED') {
      console.error('Error: Track type is not supported')
      process.exit(130)
    }

    // only add track if there is an existing config.json
    const configContents: Config = await this.readJsonFile(this.target)

    if (!configContents.assemblies?.length) {
      console.error('Error: No assemblies found. Please add one before adding tracks')
      process.exit(150)
    }
    if (configContents.assemblies.length > 1 && !assemblyNames) {
      console.error(
        'Error: Too many assemblies, cannot default to one. Please specify the assembly with the --assemblyNames flag',
      )
      process.exit(1)
    }

    // set up the track information
    trackType = trackType || this.guessTrackType(adapter.type)
    trackId = trackId || path.basename(location, path.extname(location))
    name = name || trackId
    assemblyNames = assemblyNames || configContents.assemblies[0]?.name || ''

    const configObj = config ? parseJSON(config) : {}
    const trackConfig: Track = {
      type: trackType,
      trackId,
      name,
      adapter,
      category: category?.split(',').map(c => c.trim()),
      assemblyNames: assemblyNames.split(',').map(a => a.trim()),
      description,
      ...configObj,
    }

    // any special track modifications go here
    if (trackType === 'AlignmentsTrack') {
      const assembly = configContents.assemblies.find(
        asm => asm.name === assemblyNames,
      )
      if (assembly) {
        // @ts-expect-error
        trackConfig.adapter.sequenceAdapter = assembly.sequence.adapter
      } else if (!skipCheck) {
        console.error(`Error: Failed to find assemblyName ${assemblyNames}`)
        process.exit(1)
      }
    }

    if (!configContents.tracks) {
      configContents.tracks = []
    }

    const idx = configContents.tracks.findIndex(c => c.trackId === trackId)

    if (idx !== -1) {
      this.debug(`Found existing trackId ${trackId} in configuration`)
      if (force || overwrite) {
        this.debug(`Overwriting track ${trackId} in configuration`)
        configContents.tracks[idx] = trackConfig
      } else {
        console.error(
          `Error: Cannot add track with id ${trackId}, a track with that id already exists (use --force to override)`,
        )
        process.exit(160)
      }
    } else {
      configContents.tracks.push(trackConfig)
    }

    if (load && load !== 'inPlace') {
      await Promise.all(
        Object.values(this.guessFileNames({ location, index, bed1, bed2 }))
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

  guessFileNames({
    location,
    index,
    bed1,
    bed2,
  }: {
    location: string
    index?: string
    bed1?: string
    bed2?: string
  }) {
    if (/\.anchors(.simple)?$/i.test(location)) {
      return {
        file: location,
        bed1: bed1!,
        bed2: bed2!,
      }
    } else if (/\.bam$/i.test(location)) {
      return {
        file: location,
        index: index || `${location}.bai`,
      }
    } else if (/\.cram$/i.test(location)) {
      return {
        file: location,
        index: index || `${location}.crai`,
      }
    } else if (
      /\.gff3?\.b?gz$/i.test(location) ||
      /\.vcf\.b?gz$/i.test(location) ||
      /\.bed\.b?gz$/i.test(location) ||
      /\.pif\.b?gz$/i.test(location)
    ) {
      return {
        file: location,
        index: index || `${location}.tbi`,
      }
    } else if (/\.(fa|fasta|fas|fna|mfa)$/i.test(location)) {
      return {
        file: location,
        index: index || `${location}.fai`,
      }
    } else if (/\.(fa|fasta|fas|fna|mfa)\.b?gz$/i.test(location)) {
      return {
        file: location,
        index: `${location}.fai`,
        index2: `${location}.gzi`,
      }
    } else if (
      /\.2bit$/i.test(location) ||
      /\.bedpe(\.gz)?$/i.test(location) ||
      /\/trackData.jsonz?$/i.test(location) ||
      /\/sparql$/i.test(location) ||
      /\.out(\.gz)?$/i.test(location) ||
      /\.paf(\.gz)?$/i.test(location) ||
      /\.delta(\.gz)?$/i.test(location) ||
      /\.bed?$/i.test(location) ||
      /\.(bw|bigwig)$/i.test(location) ||
      /\.(bb|bigbed)$/i.test(location) ||
      /\.vcf$/i.test(location) ||
      /\.gtf?$/i.test(location) ||
      /\.gff3?$/i.test(location) ||
      /\.chain(\.gz)?$/i.test(location) ||
      /\.hic$/i.test(location)
    ) {
      return {
        file: location,
      }
    }

    return {}
  }

  // find way to import this instead of having to paste it
  guessAdapter({
    location,
    protocol,
    index,
    bed1,
    bed2,
  }: {
    location: string
    protocol: string
    index?: string
    bed1?: string
    bed2?: string
  }) {
    const makeLocation = makeLocationProtocol(protocol)
    if (/\.bam$/i.test(location)) {
      return {
        type: 'BamAdapter',
        bamLocation: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.bai`),
          indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'BAI',
        },
      }
    } else if (/\.cram$/i.test(location)) {
      return {
        type: 'CramAdapter',
        cramLocation: makeLocation(location),
        craiLocation: makeLocation(`${location}.crai`),
      }
    } else if (/\.gff3?$/i.test(location)) {
      return {
        type: 'Gff3Adapter',
        gffLocation: makeLocation(location),
      }
    } else if (/\.gff3?\.b?gz$/i.test(location)) {
      return {
        type: 'Gff3TabixAdapter',
        gffGzLocation: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.tbi`),
          indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
        },
      }
    } else if (/\.gtf?$/i.test(location)) {
      return {
        type: 'GtfAdapter',
        gtfLocation: makeLocation(location),
      }
    } else if (/\.vcf$/i.test(location)) {
      return {
        type: 'VcfAdapter',
        vcfLocation: makeLocation(location),
      }
    } else if (/\.vcf\.b?gz$/i.test(location)) {
      return {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.tbi`),
          indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
        },
      }
    } else if (/\.vcf\.idx$/i.test(location)) {
      return {
        type: 'UNSUPPORTED',
      }
    } else if (/\.bedpe(.gz)?$/i.test(location)) {
      return {
        type: 'BedpeAdapter',
        bedpeLocation: makeLocation(location),
      }
    } else if (/\.bed$/i.test(location)) {
      return {
        type: 'BedAdapter',
        bedLocation: makeLocation(location),
      }
    } else if (/\.pif\.b?gz$/i.test(location)) {
      return {
        type: 'PairwiseIndexedPAFAdapter',
        pifGzLocation: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.tbi`),
          indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
        },
      }
    } else if (/\.bed\.b?gz$/i.test(location)) {
      return {
        type: 'BedTabixAdapter',
        bedGzLocation: makeLocation(location),
        index: {
          location: makeLocation(index || `${location}.tbi`),
          indexType: index?.toUpperCase().endsWith('CSI') ? 'CSI' : 'TBI',
        },
      }
    } else if (/\.(bb|bigbed)$/i.test(location)) {
      return {
        type: 'BigBedAdapter',
        bigBedLocation: makeLocation(location),
      }
    } else if (/\.(bw|bigwig)$/i.test(location)) {
      return {
        type: 'BigWigAdapter',
        bigWigLocation: makeLocation(location),
      }
    } else if (/\.(fa|fasta|fna|mfa)$/i.test(location)) {
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation: makeLocation(location),
        faiLocation: makeLocation(index || `${location}.fai`),
      }
    } else if (/\.(fa|fasta|fna|mfa)\.b?gz$/i.test(location)) {
      return {
        type: 'BgzipFastaAdapter',
        fastaLocation: makeLocation(location),
        faiLocation: makeLocation(`${location}.fai`),
        gziLocation: makeLocation(`${location}.gzi`),
      }
    } else if (/\.2bit$/i.test(location)) {
      return {
        type: 'TwoBitAdapter',
        twoBitLocation: makeLocation(location),
      }
    } else if (/\.sizes$/i.test(location)) {
      return {
        type: 'UNSUPPORTED',
      }
    } else if (/\/trackData.jsonz?$/i.test(location)) {
      return {
        type: 'NCListAdapter',
        rootUrlTemplate: makeLocation(location),
      }
    } else if (/\/sparql$/i.test(location)) {
      return {
        type: 'SPARQLAdapter',
        endpoint: location,
      }
    } else if (/\.hic$/i.test(location)) {
      return {
        type: 'HicAdapter',
        hicLocation: makeLocation(location),
      }
    } else if (/\.paf(.gz)?$/i.test(location)) {
      return {
        type: 'PAFAdapter',
        pafLocation: makeLocation(location),
      }
    } else if (/\.out(.gz)?$/i.test(location)) {
      return {
        type: 'MashMapAdapter',
        outLocation: makeLocation(location),
      }
    } else if (/\.chain(.gz)?$/i.test(location)) {
      return {
        type: 'ChainAdapter',
        chainLocation: makeLocation(location),
      }
    } else if (/\.delta(.gz)?$/i.test(location)) {
      return {
        type: 'DeltaAdapter',
        deltaLocation: makeLocation(location),
      }
    } else if (/\.anchors(.gz)?$/i.test(location)) {
      return {
        type: 'MCScanAnchorsAdapter',
        mcscanAnchorsLocation: makeLocation(location),
        bed1Location: bed1 ? makeLocation(bed1) : undefined,
        bed2Location: bed2 ? makeLocation(bed2) : undefined,
      }
    } else if (/\.anchors.simple(.gz)?$/i.test(location)) {
      return {
        type: 'MCScanSimpleAnchorsAdapter',
        mcscanSimpleAnchorsLocation: makeLocation(location),
        bed1Location: bed1 ? makeLocation(bed1) : undefined,
        bed2Location: bed2 ? makeLocation(bed2) : undefined,
      }
    }

    return {
      type: 'UNKNOWN',
    }
  }

  guessTrackType(adapterType: string): string {
    return adapterTypesToTrackTypeMap[adapterType] || 'FeatureTrack'
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

const adapterTypesToTrackTypeMap: Record<string, string> = {
  BamAdapter: 'AlignmentsTrack',
  CramAdapter: 'AlignmentsTrack',
  BgzipFastaAdapter: 'ReferenceSequenceTrack',
  BigWigAdapter: 'QuantitativeTrack',
  IndexedFastaAdapter: 'ReferenceSequenceTrack',
  TwoBitAdapter: 'ReferenceSequenceTrack',
  VcfTabixAdapter: 'VariantTrack',
  VcfAdapter: 'VariantTrack',
  BedpeAdapter: 'VariantTrack',
  BedAdapter: 'FeatureTrack',
  HicAdapter: 'HicTrack',
  PAFAdapter: 'SyntenyTrack',
  DeltaAdapter: 'SyntenyTrack',
  ChainAdapter: 'SyntenyTrack',
  MashMapAdapter: 'SyntenyTrack',
  PairwiseIndexedPAFAdapter: 'SyntenyTrack',
  MCScanAnchorsAdapter: 'SyntenyTrack',
  MCScanSimpleAnchorsAdapter: 'SyntenyTrack',
}