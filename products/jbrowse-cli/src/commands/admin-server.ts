import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseArgs } from 'util'

import cors from 'cors'
import express from 'express'

import { debug, writeJsonFile, readJsonFile, printHelp } from '../utils'

import type { Express, Request, Response } from 'express'

/**
 * Validates if a port number is in the valid range
 * @param port - The port number to validate
 * @returns Whether the port is valid
 */
function isValidPort(port: number) {
  return port > 0 && port < 65535
}

/**
 * Parses and validates a port string
 * @param portStr - The port string to parse
 * @returns The parsed port number
 * @throws Error if port is invalid
 */
function parsePort(portStr: string | undefined, defaultPort = 9090): number {
  if (!portStr) {
    return defaultPort
  }

  const parsedPort = Number.parseInt(portStr, 10)
  if (!isValidPort(parsedPort)) {
    throw new Error(`${portStr} is not a valid port`)
  }

  return parsedPort
}

/**
 * Generates a random alphanumeric string to serve as admin key
 * @returns A random hex string
 */
function generateKey() {
  return crypto.randomBytes(5).toString('hex')
}

/**
 * Sets up the configuration file
 * @param root - The root directory for the config file
 * @returns The configuration file path and base directory
 */
async function setupConfigFile(
  root = '.',
): Promise<{ outFile: string; baseDir: string }> {
  const output = root
  const isDir = fs.lstatSync(output).isDirectory()
  const outFile = isDir ? `${output}/config.json` : output
  const baseDir = path.dirname(outFile)

  if (fs.existsSync(outFile)) {
    debug(`Found existing config file ${outFile}`)
  } else {
    debug(`Creating config file ${outFile}`)
    await writeJsonFile(outFile, {
      assemblies: [],
      configuration: {},
      connections: [],
      defaultSession: {
        name: 'New Session',
      },
      tracks: [],
    })
  }

  return { outFile, baseDir }
}

/**
 * Sets up the Express server with routes
 * @param baseDir - The base directory for static files
 * @param outFile - The default config file path
 * @param bodySizeLimit - The size limit for request bodies
 * @returns The Express app, admin key, and key file path
 */
function setupServer(
  baseDir: string,
  outFile: string,
  bodySizeLimit: string,
): {
  app: Express
  key: string
  keyPath: string
} {
  // Create Express application
  const app = express()

  // Configure middleware
  app.use(express.static(baseDir))
  app.use(cors())
  app.use(express.json({ limit: bodySizeLimit }))

  // Add error handling middleware
  app.use((err: any, _req: Request, res: Response, next: () => void) => {
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
  } catch (error: any) {
    console.error(`Failed to write admin key to ${keyPath}:`, error.message)
    // Continue anyway, as this is not critical
  }

  // Set up routes
  setupRoutes(app, baseDir, outFile, key)

  return { app, key, keyPath }
}

/**
 * Sets up the API routes for the server
 * @param app - The Express app
 * @param baseDir - The base directory for config files
 * @param outFile - The default config file path
 * @param key - The admin key for authentication
 */
function setupRoutes(
  app: Express,
  baseDir: string,
  outFile: string,
  key: string,
): void {
  // Root route
  app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send('JBrowse Admin Server')
  })

  // Update config route
  app.post('/updateConfig', (req: Request, res: Response) => {
    const { body } = req
    // Check for adminKey in both query parameters and request body for backward compatibility
    const adminKeyFromQuery = req.query.adminKey as string | undefined
    const adminKeyFromBody = body.adminKey as string | undefined
    const adminKey = adminKeyFromBody || adminKeyFromQuery
    const config = body.config as string | undefined
    // Get configPath from either body or query parameters
    const configPathParam =
      body.configPath || (req.query.config as string | undefined)

    if (adminKey !== key) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send('Error: Invalid admin key')
      return
    }

    // Remove adminKey from body before saving to config
    if (body.adminKey) {
      delete body.adminKey
    }

    try {
      // Normalize the config path
      const configPath = configPathParam
        ? path.normalize(path.join(baseDir, configPathParam))
        : outFile

      // Check for directory traversal attempts
      const normalizedBaseDir = path.normalize(baseDir)
      const relPath = path.relative(normalizedBaseDir, configPath)

      // Ensure the config path is within the base directory and doesn't
      // contain path traversal
      if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
        res.status(401).setHeader('Content-Type', 'text/plain')
        res.send('Error: Cannot perform directory traversal')
        return
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
      res.setHeader('Content-Type', 'text/plain')
      res.send('Config updated successfully')
    } catch (error) {
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Error: Failed to update config')
    }
  })

  // Get config route
  app.get('/config', (req: Request, res: Response) => {
    const { body } = req
    // Check for adminKey in both query parameters and request body for backward compatibility
    const adminKeyFromQuery = req.query.adminKey as string | undefined
    const adminKeyFromBody = body?.adminKey as string | undefined
    const adminKey = adminKeyFromBody || adminKeyFromQuery
    // Get configPath from query parameters or body
    const configPathParam =
      body?.configPath || (req.query.config as string | undefined)

    if (adminKey !== key) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send('Error: Invalid admin key')
      return
    }

    try {
      // Normalize the config path
      const configPath = configPathParam
        ? path.normalize(path.join(baseDir, configPathParam))
        : outFile

      // Check for directory traversal attempts
      const normalizedBaseDir = path.normalize(baseDir)
      const relPath = path.relative(normalizedBaseDir, configPath)

      // Ensure the config path is within the base directory and doesn't contain path traversal
      if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
        res.status(401).setHeader('Content-Type', 'text/plain')
        res.send('Error: Cannot perform directory traversal')
        return
      }

      if (fs.existsSync(configPath)) {
        const config = fs.readFileSync(configPath, 'utf8')
        res.setHeader('Content-Type', 'text/plain')
        res.send(config)
      } else {
        res.status(404).setHeader('Content-Type', 'text/plain')
        res.send('Error: Config file not found')
      }
    } catch (error: any) {
      console.error('Error reading config:', error)
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Error: Failed to read config')
    }
  })
}

/**
 * Starts the server and sets up shutdown handlers
 * @param app - The Express app
 * @param port - The port to listen on
 * @param key - The admin key
 * @param outFile - The config file path
 * @param keyPath - The path to the key file
 */
function startServer(
  app: Express,
  port: number,
  key: string,
  outFile: string,
  keyPath: string,
): void {
  // Start the server
  const server = app.listen(port, () => {
    console.log(
      `Admin server started on port ${port}\n\n` +
        `To access the admin interface, open your browser to:\n` +
        `http://localhost:${port}?adminKey=${key}\n\n` +
        `Admin key: ${key}\n` +
        `Config file: ${outFile}\n\n` +
        `To stop the server, press Ctrl+C`,
    )
  })

  // Handle server errors
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use`)
    } else {
      console.error('Server error:', error.message)
    }
    process.exit(1)
  })

  // Common shutdown handler
  const shutdownHandler = () => {
    console.log('\nShutting down admin server...')
    server.close(() => {
      // Clean up admin key file
      try {
        fs.unlinkSync(keyPath)
        debug(`Removed admin key file: ${keyPath}`)
      } catch (error) {
        // Ignore errors when cleaning up
      }
      process.exit(0)
    })
  }

  // Handle server shutdown
  process.on('SIGINT', shutdownHandler)
  process.on('SIGTERM', shutdownHandler)
}

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

  const { outFile, baseDir } = await setupConfigFile(root)

  // Parse and validate port
  let port: number
  try {
    port = parsePort(flags.port)
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }

  // Set up the Express server
  const { app, key, keyPath } = setupServer(baseDir, outFile, bodySizeLimit)

  // Start the server and set up shutdown handlers
  startServer(app, port, key, outFile, keyPath)
}
