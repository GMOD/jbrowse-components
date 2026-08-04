import { parseArgs } from 'node:util'

import {
  isRecord,
  printHelp,
  readConfigFile,
  readJsonFile,
  resolveConfigPath,
  writeJsonFile,
} from '../utils.ts'

import type { Config } from '../base.ts'

const description = 'Set a default session with views and tracks'

const examples = [
  '# set default session for the config.json in your current directory',
  '$ jbrowse set-default-session --session /path/to/default/session.json',
  '',
  '# make session.json the defaultSession on the specified target config.json file',
  '$ jbrowse set-default-session --target /path/to/jb2/installation/config.json --session session.json',
  '',
  '# override the name stored in the session file',
  '$ jbrowse set-default-session --session session.json --name "My default view"',
  '',
  '# pipe a session in from another program',
  `$ jq '.defaultSession' other/config.json | jbrowse set-default-session --session -`,
  '',
  '# print the current default session',
  '$ jbrowse set-default-session --currentSession',
  '',
  '# remove the existing default session',
  '$ jbrowse set-default-session --delete',
]
const options = {
  session: {
    type: 'string',
    short: 's',
    description:
      'set path to a file containing session in json format, or "-" to read it from stdin (required, unless using delete/currentSession flags)',
  },
  name: {
    type: 'string',
    short: 'n',
    description:
      'Give a name for the default session (overrides any name in the session file; defaults to "New Default Session")',
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
      usage: 'jbrowse set-default-session [options]',
      options,
    })
    return
  }
  const {
    session,
    name,
    currentSession,
    delete: deleteDefaultSession,
  } = runFlags
  const target = await resolveConfigPath(runFlags.target, runFlags.out)
  const configContents: Config = await readConfigFile(target)

  if (deleteDefaultSession) {
    configContents.defaultSession = undefined
    await writeJsonFile(target, configContents)
  } else if (currentSession) {
    console.log(
      `The current default session is ${JSON.stringify(
        configContents.defaultSession,
      )}`,
    )
  } else if (!session) {
    throw new Error('Please provide a --session file')
  } else {
    const fileSession = await readDefaultSessionFile(session)
    await writeJsonFile(target, {
      ...configContents,
      // precedence: explicit --name > the session file's own name > fallback
      defaultSession: {
        name: 'New Default Session',
        ...fileSession,
        ...(name !== undefined ? { name } : {}),
      },
    })
  }
}

async function readDefaultSessionFile(defaultSessionFile: string) {
  const contents =
    await readJsonFile<Record<string, unknown>>(defaultSessionFile)
  // unwrap the top-level "session" if it exists, such as in files created by
  // "File -> Export session"
  const session = contents.session ?? contents
  // spreading a string or an array here silently wrote a defaultSession of
  // numeric keys, so say what is wrong with the file instead
  if (!isRecord(session)) {
    throw new Error(
      `${defaultSessionFile} does not contain a session object${
        contents.session === undefined ? '' : ' under its "session" key'
      }`,
    )
  }
  return session
}
