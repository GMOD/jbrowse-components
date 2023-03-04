import { flags } from '@oclif/command'
import fs from 'fs'

import parseJSON from 'json-parse-better-errors'
import JBrowseCommand from '../base'

const fsPromises = fs.promises

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
  tracks?: Track[]
}

export default class SetDefaultSession extends JBrowseCommand {
  // @ts-expect-error
  private target: string

  static description = 'Set a default session with views and tracks'

  static examples = [
    '$ jbrowse set-default-session --session /path/to/default/session.json',
    '$ jbrowse set-default-session --target /path/to/jb2/installation/config.json --view LinearGenomeView --tracks track1, track2, track3',
    '$ jbrowse set-default-session --view LinearGenomeView, --name newName --viewId view-no-tracks',
    '$ jbrowse set-default-session --currentSession # Prints out current default session',
  ]

  static args = []

  static flags = {
    session: flags.string({
      char: 's',
      description: 'set path to a file containing session in json format',
    }),
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
    viewId: flags.string({
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
    target: flags.string({
      description:
        'path to config file in JB2 installation directory to write out to',
    }),
    out: flags.string({
      description: 'synonym for target',
    }),
    delete: flags.boolean({
      description: 'Delete any existing default session.',
    }),
    help: flags.help({
      char: 'h',
    }),
  }

  async run() {
    const { flags: runFlags } = this.parse(SetDefaultSession)
    const {
      session,
      name,
      tracks,
      currentSession,
      view,
      viewId,
      delete: deleteDefaultSession,
    } = runFlags
    const output = runFlags.target || runFlags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const configContents: Config = await this.readJsonFile(this.target)

    if (deleteDefaultSession) {
      delete configContents.defaultSession
      this.debug(`Writing configuration to file ${this.target}`)
      await this.writeJsonFile(this.target, configContents)
      this.log(`Deleted defaultSession from ${this.target}`)
      return
    }

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
    const existingDefaultSession = configContents.defaultSession?.length > 0

    // must provide default session, or view, or tracks + view
    if (!session && !view && !tracks) {
      this.error(
        `No default session information provided, Please either provide a default session file or enter information to build a default session`,
        { exit: 120 },
      )
    } else if (session) {
      // if user provides a file, process and set as default session and exit
      const defaultJson = await this.readDefaultSessionFile(session)
      configContents.defaultSession = defaultJson
    } else {
      // use trackids if any to match to tracks in the config
      let trackIds = []
      if (tracks && configContents.tracks) {
        if (!view) {
          this.error(
            'Tracks must have a view type specified. Please rerun using the --view flag',
            { exit: 130 },
          )
        }
        trackIds = tracks.split(',').map(c => c.trim())
        trackIds.forEach(trackId => {
          this.log(trackId)
          const matchingTrack = configContents.tracks?.find(
            track => trackId === track.trackId,
          )
          if (!matchingTrack) {
            this.error(
              `Track ${trackId} has not been added to config yet.\nPlease add the track with the add-track command before adding to the default session`,
              { exit: 140 },
            )
          } else {
            foundTracks.push({
              type: matchingTrack.type,
              configuration: matchingTrack.trackId,
            })
          }
        })
      }

      configContents.defaultSession = {
        name,
        views: [
          {
            id: viewId || `${view}-${foundTracks.length}`,
            type: view,
            tracks: foundTracks,
          },
        ],
      }
    }
    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, configContents)

    this.log(
      `${
        existingDefaultSession ? 'Overwrote' : 'Added'
      } defaultSession "${name}" ${existingDefaultSession ? 'in' : 'to'} ${
        this.target
      }`,
    )
  }

  async readDefaultSessionFile(defaultSessionFile: string) {
    let defaultSessionJson: string
    try {
      defaultSessionJson = await fsPromises.readFile(defaultSessionFile, {
        encoding: 'utf8',
      })
    } catch (error) {
      return this.error('Could not read the provided file', { exit: 150 })
    }

    try {
      const session = parseJSON(defaultSessionJson)
      // return top-level "session" if it exists, such as in files created by
      // "File -> Export session"
      return session.session || session
    } catch (error) {
      return this.error('Could not parse the given default session file', {
        exit: 160,
      })
    }
  }
}
