import fs from 'fs'
import { parseArgs } from 'util'

import parseJSON from 'json-parse-better-errors'

import { printHelp, readJsonFile, writeJsonFile } from '../utils'

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

const description = 'Set a default session with views and tracks'

const examples = [
  '# set default session for the config.json in your current directory',
  '$ jbrowse set-default-session --session /path/to/default/session.json',
  '',
  '# make session.json the defaultSession on the specified target config.json file',
  '$ jbrowse set-default-session --target /path/to/jb2/installation/config.json --session session.json',
  '',
  '# print current default session',
  '$ jbrowse set-default-session --currentSession # Prints out current default session',
]
const options = {
  session: {
    type: 'string',
    short: 's',
    description:
      'set path to a file containing session in json format (required, unless using delete/currentSession flags)',
  },
  name: {
    type: 'string',
    short: 'n',
    description: 'Give a name for the default session',
    default: 'New Default Session',
  },
  currentSession: {
    type: 'boolean',
    short: 'c',
    description: 'List out the current default session',
  },
  target: {
    type: 'string',
    description:
      'path to config file in JB2 installation directory to write out to',
  },
  out: { type: 'string', description: 'synonym for target' },
  delete: {
    type: 'boolean',
    description: 'Delete any existing default session.',
  },
  help: { type: 'boolean', short: 'h', description: 'Show help' },
} as const

export async function run(args: string[]) {
  const { values: runFlags } = parseArgs({ options, args })
  if (runFlags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse add-track <track> [options]',
      options,
    })
    return
  }
  const { session, currentSession, delete: deleteDefaultSession } = runFlags
  const output = runFlags.target || runFlags.out || '.'
  const isDir = (await fsPromises.lstat(output)).isDirectory()
  const target = isDir ? `${output}/config.json` : output
  const configContents: Config = await readJsonFile(target)

  if (deleteDefaultSession) {
    configContents.defaultSession = undefined
    await writeJsonFile(target, configContents)
  } else if (currentSession) {
    console.log(
      `The current default session is ${JSON.stringify(
        configContents.defaultSession,
      )}`,
    )
    process.exit()
  } else if (!session) {
    throw new Error('Please provide a --session file')
  } else if (session) {
    await writeJsonFile(target, {
      ...configContents,
      defaultSession: await readDefaultSessionFile(session),
    })
  }
}

async function readDefaultSessionFile(defaultSessionFile: string) {
  let defaultSessionJson: string
  try {
    defaultSessionJson = await fsPromises.readFile(defaultSessionFile, {
      encoding: 'utf8',
    })
  } catch (error) {
    throw new Error('Could not read the provided file')
  }

  try {
    const session = parseJSON(defaultSessionJson)
    // return top-level "session" if it exists, such as in files created by
    // "File -> Export session"
    return session.session || session
  } catch (error) {
    throw new Error('Could not parse the given default session file')
  }
}
