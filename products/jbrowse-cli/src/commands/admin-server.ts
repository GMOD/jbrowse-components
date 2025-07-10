import { parseArgs } from 'util'

import { printHelp } from '../utils'
import {
  parsePort,
  setupConfigFile,
  setupServer,
  startServer,
} from './admin-server-utils'

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

  const examples = ['$ jbrowse admin-server', '$ jbrowse admin-server -p 8888']

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse admin-server [options]',
      options,
    })
    return
  }

  const { root, bodySizeLimit = '25mb' } = flags

  const { outFile, baseDir } = await setupConfigFile({ root })

  // Parse and validate port
  let port: number
  try {
    port = parsePort({ portStr: flags.port })
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }

  // Set up the Express server
  const { app, key, keyPath } = setupServer({ baseDir, outFile, bodySizeLimit })

  // Start the server and set up shutdown handlers
  startServer({ app, port, key, outFile, keyPath })
}
