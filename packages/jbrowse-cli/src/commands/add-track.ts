import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import {
  guessAdapter,
  guessSubadapter,
  guessTrackType,
} from '@gmod/jbrowse-core/util/tracks'

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
    await this.checkLocation()
    const { args: runArgs, flags: runFlags } = this.parse(AddTrack)
    const { track: argsTrack } = runArgs as { track: string }
    const {
      type,
      name,
      trackId,
      configLocation,
      config,
      category,
      description,
    } = runFlags

    const trackLocation = await this.resolveFileLocation(argsTrack)
    const { location, protocol } = trackLocation
    const adapter = guessAdapter(location, protocol)

    // if (type) {
    //   this.debug(`Type is: ${type}`)
    // } else {
    //   type = guessTrackType(adapter.type)
    // }

    // if (trackId) {
    //   this.debug(`Track is :${trackId}`)
    // } else
    //   trackId = path.basename(
    //     trackLocation.location,
    //     path.extname(trackLocation.location),
    //   ) // get filename and set as name

    // if (name) {
    //   this.debug(`Name is: ${name}`)
    // } else name = trackId

    let configObj = {}
    if (config) configObj = JSON.parse(config)
    const trackConfig: Track = {
      type: type || guessTrackType(adapter.type),
      trackId:
        trackId ||
        path.basename(
          trackLocation.location,
          path.extname(trackLocation.location),
        ),
      name: name || trackId,
      assemblyNames: runArgs.assemblyNames
        ? runArgs.assemblyNames.split(/,\s?/)
        : [''], // logic to get the assemblyname
      category: category ? category.split(/,\s?/) : ['Default'],
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
        const subAdapter = guessSubadapter(
          trackLocation.location,
          trackLocation.protocol,
          'SNPCoverageAdapter',
        )

        trackConfig.adapter.subAdapter = subAdapter
      }
    }

    let configContentsJson
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
      configContentsJson = await this.readJsonConfig(configLocation)
      this.debug(`Found existing config file ${configLocation}`)
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
      this.debug(
        `Found existing trackId ${trackConfig.trackId} in configuration`,
      )
      if (runFlags.force) {
        this.debug(`Overwriting track ${trackConfig.trackId} in configuration`)
        configContents.tracks[idx] = trackConfig
      } else
        this.error(
          `Cannot add track with name ${trackConfig.trackId}, a track with that name already exists.`,
          { exit: 10 },
        )
    } else configContents.tracks.push(trackConfig)

    this.debug(`Writing configuration to file ${configLocation}`)
    await fsPromises.writeFile(
      runFlags.configLocation,
      JSON.stringify(configContents, undefined, 2),
    )

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} track "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${runFlags.configLocation}`,
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

  // pretty much same as add-assembly, dont need skipCheck flag
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
      if (filePath.startsWith('..')) {
        this.warn(
          `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
        )
      }
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

  async checkLocation() {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile('manifest.json', {
        encoding: 'utf8',
      })
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
}
