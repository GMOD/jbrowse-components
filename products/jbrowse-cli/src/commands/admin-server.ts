import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Flags } from '@oclif/core'
import boxen from 'boxen'
import chalk from 'chalk'
import cors from 'cors'
import express from 'express'
import JBrowseCommand from '../base'

function isValidPort(port: number) {
  return port > 0 && port < 65535
}

// generate a string of random alphanumeric characters to serve as admin key
function generateKey() {
  return crypto.randomBytes(5).toString('hex')
}

export default class AdminServer extends JBrowseCommand {
  static description = 'Start up a small admin server for JBrowse configuration'

  static examples = ['$ jbrowse admin-server', '$ jbrowse admin-server -p 8888']

  static flags = {
    port: Flags.string({
      char: 'p',
      description: 'Specifified port to start the server on;\nDefault is 9090.',
    }),
    root: Flags.string({
      description:
        'path to the root of the JB2 installation.\nCreates ./config.json if nonexistent. note that you can navigate to ?config=path/to/subconfig.json in the web browser and it will write to rootDir/path/to/subconfig.json',
    }),
    bodySizeLimit: Flags.string({
      description:
        'Size limit of the update message; may need to increase if config is large.\nArgument is passed to bytes library for parsing: https://www.npmjs.com/package/bytes.',
      default: '25mb',
    }),

    help: Flags.help({ char: 'h' }),
  }

  async run() {
    const { flags: runFlags } = await this.parse(AdminServer)
    const { root, bodySizeLimit } = runFlags

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
    if (runFlags.port) {
      if (!isValidPort(Number.parseInt(runFlags.port, 10))) {
        this.error(`${runFlags.port} is not a valid port`)
      } else {
        port = Number.parseInt(runFlags.port, 10)
      }
    }
    const app = express()
    app.use(express.static(baseDir))
    app.use(cors())

    // POST route to save config
    app.use(express.json({ limit: bodySizeLimit }))
    app.post('/updateConfig', async (req, res) => {
      if (adminKey === req.body.adminKey) {
        this.debug('Admin key matches')
        try {
          // use directory traversal prevention
          // https://nodejs.org/en/knowledge/file-system/security/introduction/#preventing-directory-traversal
          const filename = req.body.configPath
            ? path.join(baseDir, req.body.configPath)
            : outFile
          if (!filename.startsWith(baseDir)) {
            throw new Error(
              `Cannot perform directory traversal outside of ${baseDir}`,
            )
          }
          await this.writeJsonFile(filename, req.body.config)
          res.send('Config written to disk')
        } catch (e) {
          res.status(500).send(`Could not write config file ${e}`)
        }
      } else {
        res.status(403).send('Admin key does not match')
      }
    })

    app.post(
      '/shutdown',
      async (req: express.Request, res: express.Response) => {
        this.debug('Req body: ', req.body)
        if (req.body.adminKey === adminKey) {
          this.debug('Admin key matches')
          res.send('Exiting')
          server.close()
        } else {
          res.status(403).send('Admin key does not match')
        }
      },
    )

    const adminKey = generateKey()
    const server = app.listen(port)
    // Server message adapted from `serve`
    // https://github.com/vercel/serve/blob/f65ac293c20058f809769a4dbf4951acc21df6df/bin/serve.js
    const details = server.address()
    let localAddress = ''
    let networkAddress = ''

    if (typeof details === 'string') {
      localAddress = details
    } else if (details && typeof details === 'object') {
      const address = details.address === '::' ? 'localhost' : details.address
      const ip = getNetworkAddress()

      localAddress = `http://${address}:${details.port}?adminKey=${adminKey}`
      if (ip) {
        networkAddress = `http://${ip}:${details.port}?adminKey=${adminKey}`
      }
    }
    let message = chalk.green(
      'Now serving JBrowse\nNavigate to the below URL to configure',
    )
    if (localAddress) {
      const prefix = networkAddress ? '- ' : ''
      const space = networkAddress ? '            ' : '  '

      message += `\n\n${chalk.bold(`${prefix}Local:`)}${space}${localAddress}`
    }
    if (networkAddress) {
      message += `\n${chalk.bold('- On Your Network:')}  ${networkAddress}`
    }
    this.log(boxen(message, { padding: 1, borderColor: 'blue', margin: 1 }))
    this.log(
      `If you are running yarn start you can launch http://localhost:3000?adminKey=${adminKey}&adminServer=http://localhost:${port}/updateConfig`,
    )
  }
}

function getNetworkAddress() {
  for (const network of Object.values(os.networkInterfaces())) {
    for (const networkInterface of network || []) {
      const { address, family, internal } = networkInterface
      if (family === 'IPv4' && !internal) {
        return address
      }
    }
  }
  return undefined
}
