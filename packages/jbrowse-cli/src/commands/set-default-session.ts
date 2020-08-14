import { flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import JBrowseCommand from '../base'

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

export default class SetDefaultSession extends JBrowseCommand {
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
      default: 'New Default Session',
    }),
    view: flags.string({
      char: 'v',
      description:
        'View type in config to be added as default session, i.e LinearGenomeView, CircularView, DotplotView.\nMust be provided if no default session file provided',
    }),
    viewid: flags.string({
      description: 'Identifier for the view. Will be generated on default',
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
    const {
      name,
      configLocation,
      tracks,
      currentSession,
      view,
      viewid,
    } = runFlags

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
        `The current default session is ${JSON.stringify(
          configContents.defaultSession,
        )}`,
      )
      this.exit()
    }

    const foundTracks: Track[] = []
    const existingDefaultSession = configContents.defaultSession.length > 0

    // must provide default session, or view, or tracks + view
    if (!defaultSession && !view && !tracks) {
      this.error(
        `No default session information provided, Please either provide a default session file or enter information to build a default session`,
        { exit: 15 },
      )
    } else if (defaultSession) {
      // if user provides a file, process and set as default session and exit
      const defaultJson = await this.readDefaultSessionFile(defaultSession)
      configContents.defaultSession = defaultJson
    } else {
      // use trackids if any to match to tracks in the config
      let trackIds = []
      if (tracks && configContents.tracks) {
        if (!view)
          this.error(
            'Tracks must have a view type specified. Please rerun using the --view flag',
            { exit: 80 },
          )
        trackIds = tracks.split(',').map(c => c.trim())
        trackIds.forEach(trackId => {
          this.log(trackId)
          const matchingTrack = configContents.tracks.find(
            track => trackId === track.trackId,
          )
          if (!matchingTrack)
            this.error(
              `Track ${trackId} has not been added to config yet.\nPlease add the track with the add-track command before adding to the default session`,
              { exit: 90 },
            )
          else
            foundTracks.push({
              type: matchingTrack.type,
              configuration: matchingTrack.trackId,
            })
        })
      }

      configContents.defaultSession = {
        name,
        views: [
          {
            id: viewid || `${view}-${foundTracks.length}`,
            type: view,
            tracks: foundTracks,
          },
        ],
      }
    }
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

  async readDefaultSessionFile(defaultSessionFile: string) {
    let defaultSessionJson: string
    try {
      defaultSessionJson = await fsPromises.readFile(defaultSessionFile, {
        encoding: 'utf8',
      })
    } catch (error) {
      return this.error('Could not read the provided file', { exit: 10 })
    }

    try {
      const { defaultSession } = JSON.parse(defaultSessionJson)
      return defaultSession
    } catch (error) {
      return this.error('Could not parse the given default session file', {
        exit: 20,
      })
    }
  }
}
