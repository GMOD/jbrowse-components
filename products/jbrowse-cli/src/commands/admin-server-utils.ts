import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

import cors from 'cors'
import express from 'express'

import { debug, writeJsonFile } from '../utils'

import type { Express, Request, Response } from 'express'

/**
 * Validates if a port number is in the valid range
 */
export function isValidPort(port: number): boolean {
  return port > 0 && port < 65535
}

/**
 * Parses and validates a port string
 */
export function parsePort({
  portStr,
  defaultPort = 9090,
}: {
  portStr: string | undefined
  defaultPort?: number
}): number {
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
 */
export function generateKey(): string {
  return crypto.randomBytes(5).toString('hex')
}

/**
 * Sets up the configuration file
 */
export async function setupConfigFile({
  root = '.',
}: {
  root?: string
} = {}): Promise<{ outFile: string; baseDir: string }> {
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
 * Validates admin key and extracts config path from request
 */
function validateAndExtractParams({
  req,
  key,
  baseDir,
  outFile,
}: {
  req: Request
  key: string
  baseDir: string
  outFile: string
}): { isValid: boolean; configPath?: string; error?: string } {
  const { body } = req
  // Check for adminKey in both query parameters and request body for backward compatibility
  const adminKeyFromQuery = req.query.adminKey as string | undefined
  const adminKeyFromBody = body?.adminKey as string | undefined
  const adminKey = adminKeyFromBody || adminKeyFromQuery

  if (adminKey !== key) {
    return { isValid: false, error: 'Invalid admin key' }
  }

  // Get configPath from either body or query parameters
  const configPathParam =
    body?.configPath || (req.query.config as string | undefined)

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
      return { isValid: false, error: 'Cannot perform directory traversal' }
    }

    return { isValid: true, configPath }
  } catch (error) {
    return { isValid: false, error: 'Failed to validate config path' }
  }
}

/**
 * Sets up the API routes for the server
 */
export function setupRoutes({
  app,
  baseDir,
  outFile,
  key,
}: {
  app: Express
  baseDir: string
  outFile: string
  key: string
}): void {
  // Root route
  app.get('/', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send('JBrowse Admin Server')
  })

  // Update config route
  app.post('/updateConfig', (req: Request, res: Response) => {
    const { body } = req
    const config = body.config as string | undefined

    const validation = validateAndExtractParams({ req, key, baseDir, outFile })
    if (!validation.isValid) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send(`Error: ${validation.error}`)
      return
    }

    // Remove adminKey from body before saving to config
    if (body.adminKey) {
      delete body.adminKey
    }

    try {
      fs.writeFileSync(validation.configPath!, JSON.stringify(config, null, 2))
      res.setHeader('Content-Type', 'text/plain')
      res.send('Config updated successfully')
    } catch (error) {
      res.status(500).setHeader('Content-Type', 'text/plain')
      res.send('Error: Failed to update config')
    }
  })

  // Get config route
  app.get('/config', (req: Request, res: Response) => {
    const validation = validateAndExtractParams({ req, key, baseDir, outFile })
    if (!validation.isValid) {
      res.status(401).setHeader('Content-Type', 'text/plain')
      res.send(`Error: ${validation.error}`)
      return
    }

    try {
      if (fs.existsSync(validation.configPath!)) {
        const config = fs.readFileSync(validation.configPath!, 'utf8')
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
 * Sets up the Express server with routes
 */
export function setupServer({
  baseDir,
  outFile,
  bodySizeLimit,
}: {
  baseDir: string
  outFile: string
  bodySizeLimit: string
}): {
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
  setupRoutes({ app, baseDir, outFile, key })

  return { app, key, keyPath }
}

/**
 * Starts the server and sets up shutdown handlers
 */
export function startServer({
  app,
  port,
  key,
  outFile,
  keyPath,
}: {
  app: Express
  port: number
  key: string
  outFile: string
  keyPath: string
}): void {
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
