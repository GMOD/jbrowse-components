import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import * as os from 'os'
import fetch from 'node-fetch'

interface DefaultSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Config {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assemblies?: { name: string; sequence: { [key: string]: any } }[]
  configuration?: {}
  connections?: unknown[]
  defaultSession?: DefaultSession
  tracks: Track[]
}

export default class SetDefaultSession extends Command {
  static description = 'Set a default session with views and tracks'

  static examples = []

  static args = [
    {
      name: 'defaultSession',
      required: false,
      description: 'path to a default session setup',
    },
    {
      name: 'location',
      required: false,
      description: 'path to JB2 installation',
      default: '.',
    },
  ]

  static flags = {
    name: flags.string({
      char: 'n',
      description: 'Give a name for the default session',
      default: 'New Default Sesssion',
    }),
    view: flags.string({
      char: 'v',
      description:
        'View type in config to be added as default session, will be guessed on default, i.e LinearGenomeView, CircularView, DotplotView',
    }),
    tracks: flags.string({
      char: 't',
      description:
        'Track id or track ids as comma separated string to put into default session',
    }),
    currentSession: flags.boolean({
      char: 'c',
      description: 'List out the current default session',
    }),
    configLocation: flags.string({
      description:
        'Write to a certain config.json file. Defaults to location/config.json if not specified',
    }),
    help: flags.help({
      char: 'h',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(SetDefaultSession)
    const { defaultSession, location } = runArgs
    const { name, configLocation, tracks, currentSession } = runFlags
    let { view } = runFlags

    const configPath = configLocation || path.join(location, 'config.json')

    await this.checkLocation(location)

    let configContentsJson
    try {
      configContentsJson = await this.readJsonConfig(configPath)
      this.debug(`Found existing config file ${configPath}`)
    } catch (error) {
      this.error(
        'No existing config file found, run add-assembly first to bootstrap config',
        {
          exit: 30,
        },
      )
    }

    let configContents: Config
    try {
      configContents = { ...JSON.parse(configContentsJson) }
    } catch (error) {
      this.error('Could not parse existing config file', { exit: 35 })
    }

    if (!configContents.defaultSession) configContents.defaultSession = {}

    // if user passes current session flag, print out and exit
    if (currentSession) {
      this.log(
        `The current default session is ${configContents.defaultSession}`,
      )
      this.exit()
    }

    const foundTracks: Track[] = []
    const existingDefaultSession = configContents.defaultSession.length > 0
    if (!defaultSession && !view && !tracks) {
      this.error(
        `No default session information provided, Please either provide a default session file or enter information to build a default session`,
        { exit: 15 },
      )
    }
    // if user provides a file, process and set as default session and exit
    else if (defaultSession) {
      const defaultJson = await this.readDefaultSessionFile(defaultSession)
      const message = `Set default session to session from ${defaultSession}. ${
        existingDefaultSession && 'Overwrote previous default session.'
      }`
      configContents.defaultSession = { ...defaultJson }
      this.log(message)
      this.exit()
    } else {
      // use trackids if any to match to tracks in the config and either guess or set the viewType
      let trackIds = []
      if (view) this.debug(`View type is ${view}`)
      if (tracks && configContents.tracks) {
        trackIds = tracks.split(',').map(c => c.trim())
        trackIds.forEach(trackId => {
          const idx = configContents.tracks.findIndex(
            track => trackId === track.trackId,
          )
          if (idx === -1)
            this.error(
              `Track ${trackId} has not been added to config yet.${os.EOL}Please add the track with the add-track command before adding to the default session`,
              { exit: 10 },
            )
          else foundTracks.push(configContents.tracks[idx])
          const trackViewType = this.guessViewFromTrack(
            configContents.tracks[idx].type,
          )
          view =
            !view || view === trackViewType
              ? trackViewType
              : this.error(
                  'Tracks seem to consist of multiple view types. Please rerun with only one view type per command',
                )
        })
      }

      const sessionObj = {
        name,
        views: [
          {
            type: view,
            tracks: [...foundTracks],
          },
        ],
      }

      configContents.defaultSession.push(sessionObj)
      this.debug(`Writing configuration to file ${configPath}`)
      await fsPromises.writeFile(
        configPath,
        JSON.stringify(configContents, undefined, 2),
      )

      this.log(
        `${
          existingDefaultSession ? 'Overwrote' : 'Added'
        } defaultSession "${name}" ${
          existingDefaultSession ? 'in' : 'to'
        } ${configPath}`,
      )
    }
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

  async checkLocation(userPath: string) {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile(
        path.join(userPath, 'manifest.json'),
        {
          encoding: 'utf8',
        },
      )
    } catch (error) {
      this.error(
        'Could not find the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation or provide the path to one.',
        { exit: 10 },
      )
    }

    let manifest: { name?: string } = {}
    try {
      manifest = JSON.parse(manifestJson)
    } catch (error) {
      this.error(
        'Could not parse the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation or provide the path to one.',
        { exit: 20 },
      )
    }
    if (manifest.name !== 'JBrowse') {
      this.error(
        '"name" in file "manifest.json" is not "JBrowse". Please make sure you are in the top level of a JBrowse 2 installation or provide the path to one.',
        { exit: 30 },
      )
    }
  }

  async readDefaultSessionFile(defaultSessionFile: string) {
    let defaultSessionJson: string
    try {
      defaultSessionJson = await fsPromises.readFile(defaultSessionFile, {
        encoding: 'utf8',
      })
    } catch (error) {
      return this.error('Could not read the provided file', { exit: 40 })
    }

    try {
      const defaultSession = JSON.parse(defaultSessionJson)
      return defaultSession
    } catch (error) {
      return this.error('Could not parse the given default session file', {
        exit: 50,
      })
    }
  }

  guessViewFromTrack(trackType: string) {
    switch (trackType) {
      case 'AlignmentsTrack':
      case 'SNPCoverageTrack':
      case 'PileupTrack':
        return 'LinearGenomeView'
      case 'DotplotTrack':
        return 'DotplotView'
      case 'StructuralVariantChordTrack':
        return 'CircularView'
      default:
        return 'CustomView'
    }
  }
}
