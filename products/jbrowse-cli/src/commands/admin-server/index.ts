import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseArgs } from 'util'

import cors from 'cors'
import express from 'express'

import {
  generateKey,
  parsePort,
  setupConfigFile,
  setupRoutes,
  startServer,
} from './utils.ts'
import { debug, printHelp } from '../../utils.ts'

import type { Request, Response } from 'express'
import type { Server } from 'http'

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
  const port = parsePort({ portStr: flags.port })

  // Set up the Express server
  // const { app, key, keyPath, serverRef } = setupServer({
  //   baseDir,
  //   outFile,
  //   bodySizeLimit,
  // })
  const app = express()

  // Configure middleware
  app.use(express.static(baseDir))
  app.use(cors())
  app.use(express.json({ limit: bodySizeLimit }))

  // Add error handling middleware
  app.use((err: unknown, _req: Request, res: Response, next: () => void) => {
    if (err) {
      console.error('Server error:', err)
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Internal Server Error')
    } else {
      next()
    }
  })

  // Generate admin key and store it
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

  // Create server reference for shutdown route
  const serverRef: { current: Server | null } = { current: null }

  // Set up routes
  setupRoutes({
    app,
    baseDir,
    outFile,
    key,
    serverRef,
  })

  // Start the server and set up shutdown handlers
  startServer({ app, port, key, outFile, keyPath, serverRef })
}
