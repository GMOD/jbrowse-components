import fs from 'fs'
import { parseArgs } from 'util'

import parseJSON from 'json-parse-better-errors'

import NativeCommand, { printHelp } from '../native-base'

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

export default class SetDefaultSessionNative extends NativeCommand {
  private target = ''

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

  async run(args?: string[]) {
    const options = {
      help: {
        type: 'boolean',
        short: 'h',
      },
      session: {
        type: 'string',
        short: 's',
        description: 'Set path to a file containing session in json format',
      },
      name: {
        type: 'string',
        short: 'n',
        description:
          'Give a name for the default session (default: "New Default Session")',
      },
      currentSession: {
        type: 'boolean',
        short: 'c',
        description: 'List out the current default session',
      },
      target: {
        type: 'string',
        description:
          'Path to config file in JB2 installation directory to write out to',
      },
      out: {
        type: 'string',
        description: 'Synonym for target',
      },
      delete: {
        type: 'boolean',
        description: 'Delete any existing default session',
      },
    } as const
    const { values: flags } = parseArgs({
      args,
      options,
      allowPositionals: true,
    })

    if (flags.help) {
      printHelp({
        description: SetDefaultSessionNative.description,
        examples: SetDefaultSessionNative.examples,
        usage: 'jbrowse set-default-session [options]',
        options,
      })
      return
    }

    const { session, currentSession, delete: deleteDefaultSession } = flags
    const output = flags.target || flags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const configContents: Config = await this.readJsonFile(this.target)

    if (deleteDefaultSession) {
      configContents.defaultSession = undefined
      await this.writeJsonFile(this.target, configContents)
      console.log(`Deleted default session from ${this.target}`)
    } else if (currentSession) {
      console.log(
        `The current default session is ${JSON.stringify(
          configContents.defaultSession,
          null,
          2,
        )}`,
      )
      process.exit(0)
    } else if (!session) {
      console.error('Error: Please provide a --session file')
      process.exit(120)
    } else if (session) {
      const sessionData = await this.readDefaultSessionFile(session)
      await this.writeJsonFile(this.target, {
        ...configContents,
        defaultSession: sessionData,
      })
      console.log(`Set default session from ${session} in ${this.target}`)
    }
  }

  async readDefaultSessionFile(defaultSessionFile: string) {
    let defaultSessionJson: string
    try {
      defaultSessionJson = await fsPromises.readFile(defaultSessionFile, {
        encoding: 'utf8',
      })
    } catch (error) {
      console.error('Error: Could not read the provided file')
      process.exit(150)
    }

    try {
      const session = parseJSON(defaultSessionJson)
      // return top-level "session" if it exists, such as in files created by
      // "File -> Export session"
      return session.session || session
    } catch (error) {
      console.error('Error: Could not parse the given default session file')
      process.exit(160)
    }
  }
}
