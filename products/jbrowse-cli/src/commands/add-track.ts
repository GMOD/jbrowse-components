import fs from 'fs'
import path from 'path'
import { Args, Flags } from '@oclif/core'
import parseJSON from 'json-parse-better-errors'
import JBrowseCommand from '../base'
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

export default class AddTrack extends JBrowseCommand {
  // @ts-expect-error
  target: string

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

  static args = {
    track: Args.string({
      required: true,
      description: 'Track file or URL',
    }),
  }

  static flags = {
    trackType: Flags.string({
      char: 't',
      description: 'Type of track, by default inferred from track file',
    }),
    name: Flags.string({
      char: 'n',
      description:
        'Name of the track. Will be defaulted to the trackId if none specified',
    }),
    indexFile: Flags.string({
      description: 'Optional index file for the track',
    }),
    description: Flags.string({
      char: 'd',
      description: 'Optional description of the track',
    }),
    assemblyNames: Flags.string({
      char: 'a',
      description:
        'Assembly name or names for track as comma separated string. If none, will default to the assembly in your config file',
    }),
    category: Flags.string({
      description:
        'Optional Comma separated string of categories to group tracks',
    }),
    config: Flags.string({
      description: `Any extra config settings to add to a track. i.e '{"defaultRendering": "density"}'`,
    }),
    target: Flags.string({
      description: 'path to config file in JB2 installation to write out to.',
    }),
    out: Flags.string({
      description: 'synonym for target',
    }),
    subDir: Flags.string({
      description:
        'when using --load a file, output to a subdirectory of the target dir',
      default: '',
    }),
    help: Flags.help({ char: 'h' }),
    trackId: Flags.string({
      description:
        'trackId for the track, by default inferred from filename, must be unique throughout config',
    }),
    load: Flags.string({
      char: 'l',
      description:
        'Required flag when using a local file. Choose how to manage the track. Copy, symlink, or move the track to the JBrowse directory. Or inPlace to leave track alone',
      options: ['copy', 'symlink', 'move', 'inPlace'],
    }),
    skipCheck: Flags.boolean({
      description:
        'Skip check for whether or not the file or URL exists or if you are in a JBrowse directory',
    }),
    overwrite: Flags.boolean({
      description: 'Overwrites existing track if it shares the same trackId',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    }),
    protocol: Flags.string({
      description: 'Force protocol to a specific value',
      default: 'uri',
    }),
    bed1: Flags.string({
      description: 'Used only for mcscan anchors/simpleAnchors types',
    }),
    bed2: Flags.string({
      description: 'Used only for mcscan anchors/simpleAnchors types',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = await this.parse(AddTrack)

    const { track: argsTrack } = runArgs
    const {
      config,
      skipCheck,
      force,
      overwrite,
      category,
      description,
      load,
      subDir,
      target,
      protocol,
      out,
      indexFile: index,
      bed1,
      bed2,
    } = runFlags

    const output = target || out || '.'
    const isDir = fs.lstatSync(output).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    let { trackType, trackId, name, assemblyNames } = runFlags

    const configDir = path.dirname(this.target)
    if (!argsTrack) {
      this.error(
        'No track provided. Example usage: jbrowse add-track yourfile.bam',
        { exit: 120 },
      )
    }

    if (subDir) {
      const dir = path.join(configDir, subDir)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
      }
    }
    const location = argsTrack

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
      adapter.assemblyNames = assemblyNames.split(',').map(a => a.trim())
    }

    if (isUrl(location) && load) {
      this.error(
        'The --load flag is used for local files only, but a URL was provided',
        { exit: 100 },
      )
    } else if (!isUrl(location) && !load) {
      this.error(
        `The --load flag should be used if a local file is used, example --load
        copy to copy the file into the config directory. Options for load are
        copy/move/symlink/inPlace (inPlace for no file operations)`,
        { exit: 110 },
      )
    }
    if (adapter.type === 'UNKNOWN') {
      this.error('Track type is not recognized', { exit: 120 })
    }
    if (adapter.type === 'UNSUPPORTED') {
      this.error('Track type is not supported', { exit: 130 })
    }

    // only add track if there is an existing config.json
    const configContents: Config = await this.readJsonFile(this.target)

    if (!configContents.assemblies?.length) {
      this.error('No assemblies found. Please add one before adding tracks', {
        exit: 150,
      })
    }
    if (configContents.assemblies.length > 1 && !assemblyNames) {
      this.error(
        'Too many assemblies, cannot default to one. Please specify the assembly with the --assemblyNames flag',
      )
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
        this.error(`Failed to find assemblyName ${assemblyNames}`)
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
        this.error(
          `Cannot add track with id ${trackId}, a track with that id already exists (use --force to override)`,
          { exit: 160 },
        )
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

    this.log(
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
