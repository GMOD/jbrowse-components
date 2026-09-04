import http from 'node:http'
import { parseArgs } from 'node:util'

import { printHelp } from '../../utils.ts'
import {
  createRequestHandler,
  generateKey,
  parseByteLimit,
  parsePort,
  setupConfigFile,
  startServer,
} from './utils.ts'

import type { Server } from 'node:http'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    port: {
      type: 'string',
      short: 'p',
      description: 'Specified port to start the server on (default: 9090)',
    },
    host: {
      type: 'string',
      description:
        'Interface to bind to (default: 127.0.0.1). Use 0.0.0.0 to accept ' +
        'connections from other machines',
    },
    root: {
      type: 'string',
      description: 'Path to the root of the JB2 installation',
    },
    bodySizeLimit: {
      type: 'string',
      description: 'Size limit of the update message (default: 25mb)',
    },
  } as const
  const { values: flags } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Start up a small admin server for JBrowse configuration'

  const examples = [
    '# start the admin server for the JBrowse install in the current directory',
    '$ jbrowse admin-server',
    '',
    '# start on a specific port',
    '$ jbrowse admin-server -p 8888',
    '',
    '# point at a specific JBrowse installation directory',
    '$ jbrowse admin-server --root /path/to/jb2/',
    '',
    '# raise the body size limit for very large config updates',
    '$ jbrowse admin-server --bodySizeLimit 100mb',
    '',
    '# accept connections from other machines on the network',
    '$ jbrowse admin-server --host 0.0.0.0',
  ]

  const notes =
    'The admin-server lets a browser session write changes back to ' +
    'config.json on disk, authorized by a one-time key printed in the ' +
    'startup URL. It binds to 127.0.0.1 so only this machine can reach it. ' +
    'The key gates the config routes, but the rest of the JBrowse directory ' +
    'is served unauthenticated, so widen --host only on a trusted network.'

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse admin-server [options]',
      options,
    })
    return
  }

  const { root, host, bodySizeLimit = '25mb' } = flags

  const { outFile, baseDir } = await setupConfigFile({ root })
  const port = parsePort({ portStr: flags.port })

  // the key lives only in this process and in the startup URL printed below. It
  // used to also be written to os.tmpdir()/jbrowse-admin-<key>, which nothing
  // ever read and which published the key in a filename any local user can list
  const key = generateKey()

  const serverRef: { current: Server | null } = { current: null }

  const server = http.createServer(
    createRequestHandler({
      baseDir,
      outFile,
      key,
      serverRef,
      bodySizeLimit: parseByteLimit(bodySizeLimit),
    }),
  )

  startServer({ server, port, host, key, outFile, serverRef })
}
