import { Flags } from '@oclif/core'
import fs from 'fs'

import parseJSON from 'json-parse-better-errors'
import JBrowseCommand from '../base'

const fsPromises = fs.promises

type DefaultSession = Record<string, unknown>
type Track = Record<string, unknown>

interface Config {
  assemblies?: { name: string; sequence: Record<string, unknown> }[]
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
    '$ jbrowse set-default-session --target /path/to/jb2/installation/config.json',
    '$ jbrowse set-default-session --view LinearGenomeView, --name newName',
    '$ jbrowse set-default-session --currentSession # Prints out current default session',
  ]

  static flags = {
    currentSession: Flags.boolean({
      char: 'c',
      description: 'List out the current default session',
    }),
    delete: Flags.boolean({
      description: 'Delete any existing default session.',
    }),
    help: Flags.help({
      char: 'h',
    }),
    name: Flags.string({
      char: 'n',
      default: 'New Default Session',
      description: 'Give a name for the default session',
    }),
    out: Flags.string({
      description: 'synonym for target',
    }),
    session: Flags.string({
      char: 's',
      description: 'set path to a file containing session in json format',
    }),
    target: Flags.string({
      description:
        'path to config file in JB2 installation directory to write out to',
    }),
  }

  async run() {
    const { flags: runFlags } = await this.parse(SetDefaultSession)
    const { session, currentSession, delete: deleteDefaultSession } = runFlags
    const output = runFlags.target || runFlags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const configContents: Config = await this.readJsonFile(this.target)

    if (deleteDefaultSession) {
      delete configContents.defaultSession
      await this.writeJsonFile(this.target, configContents)
    } else if (currentSession) {
      this.log(
        `The current default session is ${JSON.stringify(
          configContents.defaultSession,
        )}`,
      )
      this.exit()
    } else if (!session) {
      this.error(`Please either provide a default session file`, { exit: 120 })
    } else if (session) {
      await this.writeJsonFile(this.target, {
        ...configContents,
        defaultSession: await this.readDefaultSessionFile(session),
      })
    }
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
