import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
// import {
//   guessAdapter,
//   guessSubadapter,
//   guessTrackType,
//   UNKNOWN,
//   UNSUPPORTED,
// } from '@gmod/jbrowse-core/util/tracks'

interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Config {
  assemblies?: unknown[]
  configuration?: {}
  connections?: unknown[]
  defaultSession?: {}
  tracks?: Track[]
}

interface UriLocation {
  uri: string
}

interface LocalPathLocation {
  localPath: string
}

export default class AddTrack extends Command {
  static description = 'Add a track to a JBrowse 2 configuration'

  static examples = []

  static args = [
    {
      name: 'track',
      required: true,
      description: `track file or URL`,
    },
    {
      name: 'location',
      required: false,
      description: `location of JBrowse 2 installation. Defaults to .`,
    },
    {
      name: 'assemblyNames',
      required: false,
      description: `assembly name or names as comma separated string`,
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description: `type of track, by default inferred from track file`,
      options: [
        'AlignmentsTrack',
        'PileupTrack',
        'SNPCoverageTrack',
        'StructuralVariantChordTrack',
        'WiggleTrack',
        'VariantTrack',
        'DotplotTrack',
        'LinearSyntenyTrack',
        'BasicTrack',
      ],
    }),
    name: flags.string({
      char: 'n',
      description:
        'Name of the track. Will be defaulted to the trackId if none specified',
    }),
    configLocation: flags.string({
      char: 'c',
      description:
        'Config file; if the file does not exist, it will be created',
      default: './config.json',
    }),
    description: flags.string({
      char: 'd',
      description: 'Optional description of the track',
    }),
    help: flags.help({ char: 'h' }),
    trackId: flags.string({
      description:
        'Id for the track, by default inferred from filename, must be unique to JBrowse config',
    }),
    category: flags.string({
      description:
        'Optional Comma separated string of categories to group tracks',
    }),
    config: flags.string({
      description:
        'Any extra config settings to add to a track. i.e defaultRendering: { density }',
    }),
    // consider renderer
    force: flags.boolean({
      char: 'f',
      description: 'Overwrites any existing tracks if same track id',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddTrack)
    const { track: argsTrack } = runArgs as { track: string }
    const { configLocation, config, category, description } = runFlags
    let { type, trackId, name } = runFlags

    await this.checkLocation(runArgs.location || '')

    const trackLocation = await this.resolveFileLocation(argsTrack)
    const { location, protocol } = trackLocation
    const adapter = this.guessAdapter(location, protocol)

    if (type) {
      this.debug(`Type is: ${type}`)
    } else {
      type = this.guessTrackType(adapter.type)
    }

    if (trackId) {
      this.debug(`Track is :${trackId}`)
    } else
      trackId = path.basename(
        trackLocation.location,
        path.extname(trackLocation.location),
      ) // get filename and set as name

    if (name) {
      this.debug(`Name is: ${name}`)
    } else name = trackId

    let configObj = {}
    if (config) configObj = JSON.parse(config)
    const trackConfig: Track = {
      type,
      trackId,
      name,
      category: category ? category.split(/,\s?/) : ['Default'],
      assemblyNames: runArgs.assemblyNames
        ? runArgs.assemblyNames.split(/,\s?/)
        : [''], // logic to get the assemblyname
      adapter,
      ...configObj,
    }
    this.debug(
      `Track location: ${trackLocation.location}, index: ${
        adapter ? adapter.index : ''
      }`,
    )
    if (description) trackConfig.description = description

    switch (type) {
      case 'SNPCoverageTrack': {
        const subAdapter = this.guessSubadapter(
          trackLocation.location,
          trackLocation.protocol,
          'SNPCoverageAdapter',
        )

        trackConfig.adapter = subAdapter
      }
    }

    let configContentsJson
    const fullPath = path.join(runArgs.location || '', configLocation)
    const defaultConfig: Config = {
      assemblies: [],
      configuration: {},
      connections: [],
      defaultSession: {
        name: 'New Session',
      },
      tracks: [],
    }
    try {
      configContentsJson = await this.readJsonConfig(fullPath)
      this.debug(`Found existing config file ${fullPath}`)
    } catch (error) {
      this.debug('No existing config file found, using default config')
      configContentsJson = JSON.stringify(defaultConfig)
    }

    let configContents: Config
    try {
      configContents = { ...defaultConfig, ...JSON.parse(configContentsJson) }
    } catch (error) {
      this.error('Could not parse existing config file')
    }

    if (!configContents.tracks) {
      configContents.tracks = []
    }

    const idx = configContents.tracks.findIndex(
      configTrack => configTrack.trackId === trackId,
    )

    if (idx !== -1) {
      this.debug(`Found existing trackId ${trackId} in configuration`)
      if (runFlags.force) {
        this.debug(`Overwriting track ${trackId} in configuration`)
        configContents.tracks[idx] = trackConfig
      } else
        this.error(
          `Cannot add track with name ${trackId}, a track with that name already exists.`,
          { exit: 10 },
        )
    } else configContents.tracks.push(trackConfig)

    this.debug(`Writing configuration to file ${fullPath}`)
    await fsPromises.writeFile(
      fullPath,
      JSON.stringify(configContents, undefined, 2),
    )

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} track "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${fullPath}`,
    )
  }

  async readJsonConfig(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      const response = await fetch(locationUrl)
      return response.json()
    }
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }

  async resolveFileLocation(location: string) {
    let locationUrl: URL | undefined
    let locationPath: string | undefined
    let locationObj: {
      location: string
      protocol: 'uri' | 'localPath'
    }
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      let response
      try {
        response = await fetch(locationUrl, { method: 'HEAD' })
        if (response.ok) {
          locationObj = {
            location: locationUrl.href,
            protocol: 'uri',
          }
          return locationObj
        }
      } catch (error) {
        // ignore
      }
    }
    try {
      locationPath = await fsPromises.realpath(location)
    } catch (e) {
      // ignore
    }
    if (locationPath) {
      const filePath = path.relative(process.cwd(), locationPath)
      //   if (filePath.startsWith('..')) {
      //     this.warn(
      //       `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
      //     )
      //   }
      locationObj = {
        location: filePath,
        protocol: 'localPath',
      }
      return locationObj
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 90,
    })
  }

  async checkLocation(location: string) {
    this.log(location)
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile(
        path.join(location, 'manifest.json'),
        {
          encoding: 'utf8',
        },
      )
    } catch (error) {
      this.error(
        'Could not find the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 50 },
      )
    }
    let manifest: { name?: string } = {}
    try {
      manifest = JSON.parse(manifestJson)
    } catch (error) {
      this.error(
        'Could not parse the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 60 },
      )
    }
    if (manifest.name !== 'JBrowse') {
      this.error(
        '"name" in file "manifest.json" is not "JBrowse". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 70 },
      )
    }
  }

  // find way to import this instead of having to paste it
  guessAdapter(fileName: string, protocol: 'uri' | 'localPath') {
    function makeLocation(location: string): UriLocation | LocalPathLocation {
      if (protocol === 'uri') return { uri: location }
      if (protocol === 'localPath') return { localPath: location }
      throw new Error(`invalid protocol ${protocol}`)
    }
    if (/\.bam$/i.test(fileName))
      return {
        type: 'BamAdapter',
        bamLocation: makeLocation(fileName),
        index: { location: makeLocation(`${fileName}.bai`) },
      }
    if (/\.bai$/i.test(fileName))
      return {
        type: 'BamAdapter',
        bamLocation: makeLocation(fileName.replace(/\.bai$/i, '')),
        index: { location: makeLocation(fileName) },
      }
    if (/\.bam.csi$/i.test(fileName))
      return {
        type: 'BamAdapter',
        bamLocation: makeLocation(fileName.replace(/\.csi$/i, '')),
        index: { location: makeLocation(fileName), indexType: 'CSI' },
      }

    if (/\.cram$/i.test(fileName))
      return {
        type: 'CramAdapter',
        cramLocation: makeLocation(fileName),
        craiLocation: makeLocation(`${fileName}.crai`),
      }
    if (/\.crai$/i.test(fileName))
      return {
        type: 'CramAdapter',
        cramLocation: makeLocation(fileName.replace(/\.crai$/i, '')),
        craiLocation: makeLocation(fileName),
      }

    if (/\.gff3?$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.gff3?\.b?gz$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }
    if (/\.gff3?\.b?gz.tbi$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }
    if (/\.gff3?\.b?gz.csi$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.gtf?$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.vcf$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.vcf\.b?gz$/i.test(fileName))
      return {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(fileName),
        index: { location: makeLocation(`${fileName}.tbi`), indexType: 'TBI' },
      }
    if (/\.vcf\.b?gz\.tbi$/i.test(fileName))
      return {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(fileName.replace(/\.tbi$/i, '')),
        index: { location: makeLocation(fileName), indexType: 'TBI' },
      }
    if (/\.vcf\.b?gz\.csi$/i.test(fileName))
      return {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(fileName.replace(/\.csi$/i, '')),
        index: { location: makeLocation(fileName), indexType: 'CSI' },
      }

    if (/\.vcf\.idx$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.bed$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.bed\.b?gz$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }
    if (/\.bed.b?gz.tbi$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }
    if (/\.bed.b?gz.csi/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.bed\.idx$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\.(bb|bigbed)$/i.test(fileName))
      return {
        type: 'BigBedAdapter',
        bigBedLocation: makeLocation(fileName),
      }

    if (/\.(bw|bigwig)$/i.test(fileName))
      return {
        type: 'BigWigAdapter',
        bigWigLocation: makeLocation(fileName),
      }

    if (/\.(fa|fasta|fna|mfa)$/i.test(fileName))
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation: makeLocation(fileName),
        faiLocation: makeLocation(`${fileName}.fai`),
      }
    if (/\.(fa|fasta|fna|mfa)\.fai$/i.test(fileName))
      return {
        type: 'IndexedFastaAdapter',
        fastaLocation: makeLocation(fileName.replace(/\.fai$/i, '')),
        faiLocation: makeLocation(fileName),
      }

    if (/\.(fa|fasta|fna|mfa)\.b?gz$/i.test(fileName))
      return {
        type: 'BgzipFastaAdapter',
        fastaLocation: makeLocation(fileName),
        faiLocation: makeLocation(`${fileName}.fai`),
        gziLocation: makeLocation(`${fileName}.gzi`),
      }
    if (/\.(fa|fasta|fna|mfa)\.b?gz\.fai$/i.test(fileName))
      return {
        type: 'BgzipFastaAdapter',
        fastaLocation: makeLocation(fileName.replace(/\.fai$/i, '')),
        faiLocation: makeLocation(fileName),
        gziLocation: makeLocation(`${fileName.replace(/\.fai$/i, '')}.gzi`),
      }
    if (/\.(fa|fasta|fna|mfa)\.b?gz\.gzi$/i.test(fileName))
      return {
        type: 'BgzipFastaAdapter',
        fastaLocation: makeLocation(fileName.replace(/\.gzi$/i, '')),
        faiLocation: makeLocation(`${fileName.replace(/\.gzi$/i, '')}.fai`),
        gziLocation: makeLocation(fileName),
      }

    if (/\.2bit$/i.test(fileName))
      return {
        type: 'TwoBitAdapter',
        twoBitLocation: makeLocation(fileName),
      }

    if (/\.sizes$/i.test(fileName))
      return {
        type: 'UNSUPPORTED',
      }

    if (/\/trackData.jsonz?$/i.test(fileName))
      return {
        type: 'NCListAdapter',
        rootUrlTemplate: fileName,
      }

    if (/\/sparql$/i.test(fileName))
      return {
        type: 'SPARQLAdapter',
        endpoint: fileName,
      }

    return {
      type: 'UNKNOWN',
    }
  }

  guessSubadapter(fileName: string, protocol: string, mainAdapter: string) {
    if (/\.bam$/i.test(fileName))
      return {
        type: mainAdapter,
        subadapter: {
          type: 'BamAdapter',
          bamLocation: { [protocol]: fileName },
          index: { location: { [protocol]: `${fileName}.bai` } },
        },
      }
    if (/\.bai$/i.test(fileName))
      return {
        type: mainAdapter,
        subadapter: {
          type: 'BamAdapter',
          bamLocation: { [protocol]: fileName.replace(/\.bai$/i, '') },
          index: { location: { [protocol]: fileName } },
        },
      }
    if (/\.bam.csi$/i.test(fileName))
      return {
        type: mainAdapter,
        subadapter: {
          type: 'BamAdapter',
          bamLocation: { [protocol]: fileName.replace(/\.csi$/i, '') },
          index: { location: { [protocol]: fileName }, indexType: 'CSI' },
        },
      }

    if (/\.cram$/i.test(fileName))
      return {
        type: mainAdapter,
        subadapter: {
          type: 'CramAdapter',
          cramLocation: { [protocol]: fileName },
          craiLocation: { [protocol]: `${fileName}.crai` },
        },
      }
    if (/\.crai$/i.test(fileName))
      return {
        type: mainAdapter,
        subadapter: {
          type: 'CramAdapter',
          cramLocation: { [protocol]: fileName.replace(/\.crai$/i, '') },
          craiLocation: { [protocol]: fileName },
        },
      }
    return {
      type: 'UNSUPPORTED',
    }
  }

  guessTrackType(adapterType: string): string {
    const known: { [key: string]: string | undefined } = {
      BamAdapter: 'AlignmentsTrack',
      CramAdapter: 'AlignmentsTrack',
      BgzipFastaAdapter: 'SequenceTrack',
      BigWigAdapter: 'WiggleTrack',
      IndexedFastaAdapter: 'SequenceTrack',
      TwoBitAdapter: 'SequenceTrack',
      VcfTabixAdapter: 'VariantTrack',
    }
    return known[adapterType] || 'BasicTrack'
  }
}
