import fs from 'fs'
import { Flags } from '@oclif/core'

import parseJSON from 'json-parse-better-errors'
import JBrowseCommand from '../base'

const fsPromises = fs.promises

type DefaultSession = Record<string, unknown>
type Track = Record<string, unknown>

interface Config {
  assemblies?: { name: string; sequence: Record<string, unknown> }[]
  configuration?: Record<string, unknown>
  connections?: unknown[]
  defaultSession?: DefaultSession
  tracks?: Track[]
}

export default class SetDefaultSession extends JBrowseCommand {
  // @ts-expect-error
  private target: string

  static description = 'Set a default session with views and tracks'

  static examples = [
    '# set default session for the config.json in your current directory',
    '$ jbrowse set-default-session --session /path/to/default/session.json',
    '',
    '# make session.json the defaultSession on the specified target config.json file',
    '$ jbrowse set-default-session --target /path/to/jb2/installation/config.json --session session.json',
    '',
    '# print current default session',
    '$ jbrowse set-default-session --currentSession # Prints out current default session',
  ]

  static flags = {
    session: Flags.string({
      char: 's',
      description:
        'set path to a file containing session in json format (required, unless using delete/currentSession flags)',
    }),
    name: Flags.string({
      char: 'n',
      description: 'Give a name for the default session',
      default: 'New Default Session',
    }),
    currentSession: Flags.boolean({
      char: 'c',
      description: 'List out the current default session',
    }),
    target: Flags.string({
      description:
        'path to config file in JB2 installation directory to write out to',
    }),
    out: Flags.string({
      description: 'synonym for target',
    }),
    delete: Flags.boolean({
      description: 'Delete any existing default session.',
    }),
    help: Flags.help({
      char: 'h',
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
      configContents.defaultSession = undefined
      await this.writeJsonFile(this.target, configContents)
    } else if (currentSession) {
      this.log(
        `The current default session is ${JSON.stringify(
          configContents.defaultSession,
        )}`,
      )
      this.exit()
    } else if (!session) {
      this.error('Please provide a --session file', { exit: 120 })
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
