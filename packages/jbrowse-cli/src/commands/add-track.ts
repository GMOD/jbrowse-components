import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Config {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assemblies?: { name: string; sequence: { [key: string]: any } }[]
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

  static examples = [
    '$ jbrowse add-track /path/to/my.bam --load copy',
    '$ jbrowse add-track /path/to/my.bam /path/to/jbrowse2/installation --load symlink',
    '$ jbrowse add-track https://mywebsite.com/my.bam',
    `$ jbrowse add-track /path/to/my.bam --type AlignmentsTrack --name 'New Track' -- load move`,
    `$ jbrowse add-track /path/to/my.bam --trackId AlignmentsTrack1 --load trust --force`,
    `$ jbrowse add-track /path/to/my.bam --config '{"defaultRendering": "density"}'`,
    `$ jbrowse add-track config.json' `,
  ]

  static args = [
    {
      name: 'dataDirectory',
      required: true,
      description: `Data directory file or URL`,
    },
    {
      name: 'location',
      required: false,
      description: `location of JBrowse 2 installation. Defaults to .`,
      default: '.',
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description: `type of track, by default inferred from track file`,
    }),
    name: flags.string({
      char: 'n',
      description:
        'Name of the track. Will be defaulted to the trackId if none specified',
    }),
    description: flags.string({
      char: 'd',
      description: 'Optional description of the track',
    }),
    assemblyNames: flags.string({
      char: 'a',
      description:
        'Assembly name or names for track as comma separated string. If none, will default to the assembly in your config file',
    }),
    category: flags.string({
      description:
        'Optional Comma separated string of categories to group tracks',
    }),
    config: flags.string({
      description:
        'Any extra config settings to add to a track. i.e {"defaultRendering": "density"}',
    }),
    configLocation: flags.string({
      description:
        'Write to a certain config.json file. Defaults to location/config.json if not specified',
    }),
    help: flags.help({ char: 'h' }),
    trackId: flags.string({
      description:
        'Id for the track, by default inferred from filename, must be unique to JBrowse config',
    }),
    load: flags.string({
      char: 'l',
      description:
        'Choose how to manage the data directory. Copy, symlink, or move the data directory to the JBrowse directory. Or trust to leave data directory alone',
      options: ['copy', 'symlink', 'move', 'trust'],
    }),
    force: flags.boolean({
      char: 'f',
      description: 'Overwrites any existing tracks if same track id',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddTrack)
    const { dataDirectory: argsTrack } = runArgs as { dataDirectory: string }
    const { config, configLocation, category, description, load } = runFlags
    let { type, trackId, name, assemblyNames } = runFlags

    await this.checkLocation(runArgs.location)
    const { location, protocol, local } = await this.resolveFileLocation(
      argsTrack,
    )
    const configPath =
      configLocation || path.join(runArgs.location, 'config.json')

    let dataDirectoryLocation
    if (!local) {
      dataDirectoryLocation = location
    } else if (!load)
      this.error(
        'Local file detected. Please select a load option for the data directory with the --load flag',
        { exit: 10 },
      )
    else {
      dataDirectoryLocation = path.join(
        runArgs.location,
        path.basename(location),
      )
    }
    // copy/symlinks/moves the data directory into the jbrowse installation directory
    const filePaths = Object.values(this.guessFileNames(location))
    switch (load) {
      case 'copy': {
        await Promise.all(
          filePaths.map(async filePath => {
            if (!filePath) return
            const dataLocation = path.join(
              runArgs.location,
              path.basename(filePath),
            )

            try {
              await fsPromises.copyFile(filePath, dataLocation)
            } catch (error) {
              this.error(error, { exit: 20 })
            }
          }),
        )
        break
      }
      case 'symlink': {
        await Promise.all(
          filePaths.map(async filePath => {
            if (!filePath) return
            const dataLocation = path.join(
              runArgs.location,
              path.basename(filePath),
            )

            try {
              await fsPromises.symlink(filePath, dataLocation)
            } catch (error) {
              this.error(error, { exit: 20 })
            }
          }),
        )
        break
      }
      case 'move': {
        await Promise.all(
          filePaths.map(async filePath => {
            if (!filePath) return
            const dataLocation = path.join(
              runArgs.location,
              path.basename(filePath),
            )

            try {
              await fsPromises.rename(filePath, dataLocation)
            } catch (error) {
              this.error(error, { exit: 20 })
            }
          }),
        )
        break
      }
      case 'trust': {
        dataDirectoryLocation = location
      }
    }

    const adapter = this.guessAdapter(dataDirectoryLocation, protocol)

    // only add track if there is an existing config.json
    let configContentsJson
    try {
      configContentsJson = await this.readJsonConfig(configPath)
      this.debug(`Found existing config file ${configPath}`)
    } catch (error) {
      this.error('No existing config file found', { exit: 30 })
    }
    let configContents: Config
    try {
      configContents = { ...JSON.parse(configContentsJson) }
    } catch (error) {
      this.error('Could not parse existing config file', { exit: 35 })
    }
    if (!configContents.assemblies || !configContents.assemblies.length) {
      this.error('No assemblies found. Please add one before adding tracks', {
        exit: 100,
      })
    } else if (configContents.assemblies.length > 1) {
      this.error(
        'Too many assemblies, cannot default to one. Please specify the assembly with the --assemblyNames flag',
      )
    }

    // set up the track information
    if (type) {
      this.debug(`Type is: ${type}`)
    } else {
      type = this.guessTrackType(adapter.type)
    }

    if (trackId) {
      this.debug(`Track is :${trackId}`)
    } else trackId = path.basename(location, path.extname(location)) // get filename and set as name

    if (name) {
      this.debug(`Name is: ${name}`)
    } else name = trackId

    if (assemblyNames) {
      this.debug(`Assembly name(s) is :${assemblyNames}`)
    } else {
      assemblyNames = configContents.assemblies[0].name
      this.log(`Inferred default assembly name ${assemblyNames}`)
    }

    let configObj = {}
    if (config) configObj = JSON.parse(config)
    const trackConfig: Track = {
      type,
      trackId,
      name,
      category: category ? category.split(/,\s?/) : undefined,
      assemblyNames: assemblyNames.split(/,\s?/),
      adapter,
      ...configObj,
    }
    this.debug(
      `Track location: ${location}, index: ${adapter ? adapter.index : ''}`,
    )
    if (description) trackConfig.description = description

    // any special track modifications go here
    switch (type) {
      case 'PileupTrack':
      case 'AlignmentsTrack': {
        const idx = configContents.assemblies.findIndex(
          assemblies => assemblies.name === assemblyNames,
        )
        const sequenceAdapter = configContents.assemblies[idx].sequence.adapter
        trackConfig.adapter.sequenceAdapter = sequenceAdapter
        break
      }
      case 'SNPCoverageTrack': {
        const idx = configContents.assemblies.findIndex(
          assemblies => assemblies.name === assemblyNames,
        )
        const sequenceAdapter = configContents.assemblies[idx].sequence.adapter
        const subAdapter = this.guessSubadapter(
          location,
          protocol,
          'SNPCoverageAdapter',
        )

        trackConfig.adapter = subAdapter
        trackConfig.adapter.subadapter.sequenceAdapter = sequenceAdapter
        break
      }
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
          { exit: 40 },
        )
    } else configContents.tracks.push(trackConfig)

    this.debug(`Writing configuration to file ${configPath}`)
    await fsPromises.writeFile(
      configPath,
      JSON.stringify(configContents, undefined, 2),
    )

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} track "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${configPath}`,
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
      local: boolean
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
            local: false,
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
        protocol: 'uri',
        local: true,
      }
      return locationObj
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 90,
    })
  }

  async checkLocation(location: string) {
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

  guessFileNames(fileName: string) {
    if (/\.bam$/i.test(fileName))
      return {
        file: fileName,
        index: `${fileName}.bai`,
      }
    if (/\.bai$/i.test(fileName))
      return {
        file: fileName.replace(/\.bai$/i, ''),
        index: fileName,
      }
    if (/\.bam.csi$/i.test(fileName))
      return {
        file: fileName.replace(/\.csi$/i, ''),
        index: fileName,
      }

    if (/\.cram$/i.test(fileName))
      return {
        file: fileName,
        index: `${fileName}.crai`,
      }
    if (/\.crai$/i.test(fileName))
      return {
        file: fileName.replace(/\.crai$/i, ''),
        index: fileName,
      }

    if (/\.gff3?$/i.test(fileName)) return {}

    if (/\.gff3?\.b?gz$/i.test(fileName)) return {}
    if (/\.gff3?\.b?gz.tbi$/i.test(fileName)) return {}
    if (/\.gff3?\.b?gz.csi$/i.test(fileName)) return {}

    if (/\.gtf?$/i.test(fileName)) return {}

    if (/\.vcf$/i.test(fileName)) return {}

    if (/\.vcf\.b?gz$/i.test(fileName))
      return {
        file: fileName,
        index: `${fileName}.tbi`,
      }
    if (/\.vcf\.b?gz\.tbi$/i.test(fileName))
      return {
        file: fileName.replace(/\.tbi$/i, ''),
        index: fileName,
      }
    if (/\.vcf\.b?gz\.csi$/i.test(fileName))
      return {
        file: fileName.replace(/\.csi$/i, ''),
        index: fileName,
      }

    if (/\.vcf\.idx$/i.test(fileName)) return {}

    if (/\.bed$/i.test(fileName)) return {}

    if (/\.bed\.b?gz$/i.test(fileName)) return {}
    if (/\.bed.b?gz.tbi$/i.test(fileName)) return {}
    if (/\.bed.b?gz.csi/i.test(fileName)) return {}

    if (/\.bed\.idx$/i.test(fileName)) return {}

    if (/\.(bb|bigbed)$/i.test(fileName))
      return {
        file: fileName,
        index: undefined,
      }

    if (/\.(bw|bigwig)$/i.test(fileName))
      return {
        file: fileName,
        index: undefined,
      }

    if (/\.(fa|fasta|fna|mfa)$/i.test(fileName))
      return {
        file: fileName,
        index: `${fileName}.fai`,
      }
    if (/\.(fa|fasta|fna|mfa)\.fai$/i.test(fileName))
      return {
        file: fileName.replace(/\.fai$/i, ''),
        index: fileName,
      }

    if (/\.(fa|fasta|fna|mfa)\.b?gz$/i.test(fileName))
      return {
        file: fileName,
        index: `${fileName}.fai`,
        index2: `${fileName}.gzi`,
      }
    if (/\.(fa|fasta|fna|mfa)\.b?gz\.fai$/i.test(fileName))
      return {
        file: fileName.replace(/\.fai$/i, ''),
        index: fileName,
        index2: `${fileName.replace(/\.fai$/i, '')}.gzi`,
      }
    if (/\.(fa|fasta|fna|mfa)\.b?gz\.gzi$/i.test(fileName))
      return {
        file: fileName.replace(/\.gzi$/i, ''),
        index: `${fileName.replace(/\.gzi$/i, '')}.fai`,
        index2: fileName,
      }

    if (/\.2bit$/i.test(fileName))
      return {
        file: fileName,
      }

    if (/\.sizes$/i.test(fileName)) return {}

    if (/\/trackData.jsonz?$/i.test(fileName))
      return {
        file: fileName,
      }

    if (/\/sparql$/i.test(fileName))
      return {
        file: fileName,
      }

    return {}
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
