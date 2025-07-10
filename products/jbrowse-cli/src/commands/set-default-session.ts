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

async function readDefaultSessionFile(defaultSessionFile: string) {
  const defaultSessionJson = await fsPromises.readFile(defaultSessionFile, {
    encoding: 'utf8',
  })

  const session = parseJSON(defaultSessionJson)
  // return top-level "session" if it exists, such as in files created by
  // "File -> Export session"
  return session.session || session
}

export async function run(args?: string[]) {
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

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse set-default-session [options]',
      options,
    })
    return
  }

  const { session, currentSession, delete: deleteDefaultSession } = flags
  const output = flags.target || flags.out || '.'
  const isDir = (await fsPromises.lstat(output)).isDirectory()
  const target = isDir ? `${output}/config.json` : output
  const configContents: Config = await readJsonFile(target)

  if (deleteDefaultSession) {
    configContents.defaultSession = undefined
    await writeJsonFile(target, configContents)
    console.log(`Deleted default session from ${target}`)
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
    const sessionData = await readDefaultSessionFile(session)
    await writeJsonFile(target, {
      ...configContents,
      defaultSession: sessionData,
    })
    console.log(`Set default session from ${session} in ${target}`)
  }
}
