import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseArgs } from 'util'

import boxen from 'boxen'
import chalk from 'chalk'
import cors from 'cors'
import express from 'express'

import NativeCommand from '../native-base'

function isValidPort(port: number) {
  return port > 0 && port < 65535
}

// generate a string of random alphanumeric characters to serve as admin key
function generateKey() {
  return crypto.randomBytes(5).toString('hex')
}

export default class AdminServerNative extends NativeCommand {
  static description = 'Start up a small admin server for JBrowse configuration'

  static examples = ['$ jbrowse admin-server', '$ jbrowse admin-server -p 8888']

  async run() {
    const { values: flags, positionals } = parseArgs({
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

    const output = root || '.'
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

    // start server with admin key in URL query string
    let port = 9090
    if (flags.port) {
      const parsedPort = Number.parseInt(flags.port, 10)
      if (!isValidPort(parsedPort)) {
        console.error(`Error: ${flags.port} is not a valid port`)
        process.exit(1)
      } else {
        port = parsedPort
      }
    }
    
    const app = express()
    app.use(express.static(baseDir))
    app.use(cors())
    app.use(express.json({ limit: bodySizeLimit }))

    const key = generateKey()
    const keyPath = path.join(os.tmpdir(), `jbrowse-admin-${key}`)
    fs.writeFileSync(keyPath, key)

    app.get('/', (req, res) => {
      res.json({ message: 'JBrowse Admin Server' })
    })

    app.post('/updateConfig', (req, res) => {
      const { body } = req
      const { adminKey } = req.query

      if (adminKey !== key) {
        res.status(401).json({ error: 'Invalid admin key' })
        return
      }

      try {
        const configPath = req.query.config ? path.join(baseDir, req.query.config as string) : outFile
        
        // Ensure the config path is within the base directory for security
        if (!configPath.startsWith(baseDir)) {
          res.status(403).json({ error: 'Invalid config path' })
          return
        }

        fs.writeFileSync(configPath, JSON.stringify(body, null, 2))
        res.json({ message: 'Config updated successfully' })
      } catch (error) {
        console.error('Error updating config:', error)
        res.status(500).json({ error: 'Failed to update config' })
      }
    })

    app.get('/config', (req, res) => {
      const { adminKey } = req.query

      if (adminKey !== key) {
        res.status(401).json({ error: 'Invalid admin key' })
        return
      }

      try {
        const configPath = req.query.config ? path.join(baseDir, req.query.config as string) : outFile
        
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
      } catch (error) {
        console.error('Error reading config:', error)
        res.status(500).json({ error: 'Failed to read config' })
      }
    })

    const server = app.listen(port, () => {
      console.log('')
      console.log(
        boxen(
          chalk.green(
            `Admin server started on port ${port}\\n\\n` +
            `To access the admin interface, open your browser to:\\n` +
            `http://localhost:${port}?adminKey=${key}\\n\\n` +
            `Admin key: ${key}\\n` +
            `Config file: ${outFile}\\n\\n` +
            `To stop the server, press Ctrl+C`,
          ),
          {
            padding: 1,
            margin: 1,
            // @ts-expect-error
            borderStyle: 'round',
            borderColor: 'green',
          },
        ),
      )
      console.log('')
    })

    // Handle server shutdown
    process.on('SIGINT', () => {
      console.log('\\nShutting down admin server...')
      server.close(() => {
        // Clean up admin key file
        try {
          fs.unlinkSync(keyPath)
        } catch (error) {
          // Ignore errors when cleaning up
        }
        process.exit(0)
      })
    })

    process.on('SIGTERM', () => {
      console.log('\\nShutting down admin server...')
      server.close(() => {
        // Clean up admin key file
        try {
          fs.unlinkSync(keyPath)
        } catch (error) {
          // Ignore errors when cleaning up
        }
        process.exit(0)
      })
    })
  }

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