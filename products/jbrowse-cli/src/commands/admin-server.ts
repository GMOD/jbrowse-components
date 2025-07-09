// Node.js built-in modules
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseArgs } from 'util'

// Third-party dependencies
import cors from 'cors'
import express from 'express'

import NativeCommand from '../native-base'

import type { Express, Request, Response } from 'express'

// Local imports

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

export default class AdminServerNative extends NativeCommand {
  static description = 'Start up a small admin server for JBrowse configuration'

  static examples = ['$ jbrowse admin-server', '$ jbrowse admin-server -p 8888']

  /**
   * Sets up the configuration file
   * @param root - The root directory for the config file
   * @returns The configuration file path and base directory
   */
  async setupConfigFile(
    output = '.',
  ): Promise<{ outFile: string; baseDir: string }> {
    const isDir = fs.lstatSync(output).isDirectory()
    const outFile = isDir ? `${output}/config.json` : output
    const baseDir = path.dirname(outFile)

    if (fs.existsSync(outFile)) {
      this.debug(`Found existing config file ${outFile}`)
    } else {
      this.debug(`Creating config file ${outFile}`)
      await this.writeJsonFile(outFile, {
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
  setupServer(
    baseDir: string,
    outFile: string,
    bodySizeLimit: string,
  ): {
    app: Express
    key: string
    keyPath: string
  } {
    const app = express()
    app.use(express.static(baseDir))
    app.use(cors())
    app.use(express.json({ limit: bodySizeLimit }))

    const key = generateKey()
    const keyPath = path.join(os.tmpdir(), `jbrowse-admin-${key}`)
    fs.writeFileSync(keyPath, key)

    // Set up routes
    this.setupRoutes(app, baseDir, outFile, key)

    return { app, key, keyPath }
  }

  /**
   * Sets up the API routes for the server
   * @param app - The Express app
   * @param baseDir - The base directory for config files
   * @param outFile - The default config file path
   * @param key - The admin key for authentication
   */
  setupRoutes(
    app: Express,
    baseDir: string,
    outFile: string,
    key: string,
  ): void {
    // Root route
    app.get('/', (_req: Request, res: Response) => {
      res.json({ message: 'JBrowse Admin Server' })
    })

    // Update config route
    app.post('/updateConfig', (req: Request, res: Response) => {
      const { body } = req
      const { adminKey } = req.query

      if (adminKey !== key) {
        res.status(401).json({ error: 'Invalid admin key' })
        return
      }

      try {
        const configPath = req.query.config
          ? path.join(baseDir, req.query.config as string)
          : outFile

        // Ensure the config path is within the base directory for security
        if (!configPath.startsWith(baseDir)) {
          res.status(403).json({ error: 'Invalid config path' })
          return
        }

        fs.writeFileSync(configPath, JSON.stringify(body, null, 2))
        res.json({ message: 'Config updated successfully' })
      } catch (error: any) {
        console.error('Error updating config:', error)
        res.status(500).json({ error: 'Failed to update config' })
      }
    })

    // Get config route
    app.get('/config', (req: Request, res: Response) => {
      const { adminKey } = req.query

      if (adminKey !== key) {
        res.status(401).json({ error: 'Invalid admin key' })
        return
      }

      try {
        const configPath = req.query.config
          ? path.join(baseDir, req.query.config as string)
          : outFile

        // Ensure the config path is within the base directory for security
        if (!configPath.startsWith(baseDir)) {
          res.status(403).json({ error: 'Invalid config path' })
          return
        }

        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
          res.json(config)
        } else {
          res.status(404).json({ error: 'Config file not found' })
        }
      } catch (error: any) {
        console.error('Error reading config:', error)
        res.status(500).json({ error: 'Failed to read config' })
      }
    })
  }

  async run() {
    const { values: flags } = parseArgs({
      args: process.argv.slice(3), // Skip node, script, and command name
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        port: {
          type: 'string',
          short: 'p',
        },
        root: {
          type: 'string',
        },
        bodySizeLimit: {
          type: 'string',
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    const { root, bodySizeLimit = '25mb' } = flags

    const { outFile, baseDir } = await this.setupConfigFile(root)

    // Parse and validate port
    let port: number
    try {
      port = parsePort(flags.port)
    } catch (error: any) {
      console.error(`Error: ${error.message}`)
      process.exit(1)
    }

    // Set up the Express server
    const { app, key, keyPath } = this.setupServer(
      baseDir,
      outFile,
      bodySizeLimit,
    )

    // Start the server and set up shutdown handlers
    this.startServer(app, port, key, outFile, keyPath)
  }

  /**
   * Starts the server and sets up shutdown handlers
   * @param app - The Express app
   * @param port - The port to listen on
   * @param key - The admin key
   * @param outFile - The config file path
   * @param keyPath - The path to the key file
   */
  startServer(
    app: Express,
    port: number,
    key: string,
    outFile: string,
    keyPath: string,
  ): void {
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

    // Common shutdown handler
    const shutdownHandler = () => {
      console.log('\nShutting down admin server...')
      server.close(() => {
        // Clean up admin key file
        try {
          fs.unlinkSync(keyPath)
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

  /**
   * Display help information for the command
   */
  showHelp() {
    console.log(`
${AdminServerNative.description}

USAGE
  $ jbrowse admin-server [options]

OPTIONS
  -h, --help                    Show help
  -p, --port <port>             Specified port to start the server on (default: 9090)
  --root <root>                 Path to the root of the JB2 installation
  --bodySizeLimit <limit>       Size limit of the update message (default: 25mb)

EXAMPLES
${AdminServerNative.examples.join('\n')}
`)
  }
}
