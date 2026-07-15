import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

import cors from 'cors'
import express, { json, static as serveStatic } from 'express'

import {
  generateKey,
  parsePort,
  setupConfigFile,
  setupRoutes,
  startServer,
} from './utils.ts'
import { debug, printHelp } from '../../utils.ts'

import type { Request, Response } from 'express'
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
  ]

  const notes =
    'The admin-server lets a browser session write changes back to ' +
    'config.json on disk, authorized by a one-time key printed in the ' +
    'startup URL. It is meant for local configuration only: run it on a ' +
    'trusted machine and do not expose the port to untrusted networks or the ' +
    'public internet.'

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

  const { root, bodySizeLimit = '25mb' } = flags

  const { outFile, baseDir } = await setupConfigFile({ root })
  const port = parsePort({ portStr: flags.port })
  const app = express()

  app.use(serveStatic(baseDir))
  app.use(cors())
  app.use(json({ limit: bodySizeLimit }))

  const key = generateKey()
  const keyPath = path.join(os.tmpdir(), `jbrowse-admin-${key}`)

  try {
    fs.writeFileSync(keyPath, key)
    debug(`Admin key stored at ${keyPath}`)
  } catch (error) {
    console.error(
      `Failed to write admin key to ${keyPath}:`,
      error instanceof Error ? error.message : error,
    )
    // Continue anyway, as this is not critical
  }

  const serverRef: { current: Server | null } = { current: null }

  setupRoutes({ app, baseDir, outFile, key, serverRef })

  // error-handling middleware must be registered after the routes it guards so
  // it can catch errors thrown from them (and from the json() body parser)
  app.use((err: unknown, _req: Request, res: Response, next: () => void) => {
    if (err) {
      console.error('Server error:', err)
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Internal Server Error')
    } else {
      next()
    }
  })

  startServer({ app, port, key, outFile, keyPath, serverRef })
}
