import { flags } from '@oclif/command'
import fs, { promises as fsPromises } from 'fs'
import crypto from 'crypto'
import path from 'path'
import express from 'express'
import JBrowseCommand, { Config } from '../base'

function isValidPort(port: number) {
  return port > 0 && port < 65535
}

// generate a string of random alphanumeric characters to serve as admin key
function generateKey() {
  return crypto.randomBytes(5).toString('hex')
}

export default class AdminServer extends JBrowseCommand {
  // @ts-ignore
  private target: string

  static description = 'Start up a small admin server for JBrowse configuration'

  static examples = ['$ jbrowse admin-server', '$ jbrowse admin-server -p 8888']

  static flags = {
    port: flags.string({
      char: 'p',
      description: 'Specifified port to start the server on;\nDefault is 9090.',
    }),
    target: flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
    }),
    out: flags.string({
      description: 'synonym for target',
    }),
    skipCheck: flags.boolean({
      description: "Don't check whether or not you are in a JBrowse directory",
    }),
    help: flags.help({ char: 'h' }),
  }

  async run() {
    const { flags: runFlags } = this.parse(AdminServer)

    const output = runFlags.target || runFlags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    // check if the config file exists, if none exists write default
    const defaultConfig: Config = {
      assemblies: [],
      configuration: {},
      connections: [],
      defaultSession: {
        name: 'New Session',
      },
      tracks: [],
    }

    if (fs.existsSync(this.target)) {
      this.debug(`Found existing config file ${this.target}`)
    } else {
      this.debug(`Creating config file ${this.target}`)
      await this.writeJsonFile('./config.json', defaultConfig)
    }

    // start server with admin key in URL query string
    let port = 9090
    if (runFlags.port) {
      if (!isValidPort(parseInt(runFlags.port, 10))) {
        this.error(`${runFlags.port} is not a valid port`)
      } else {
        port = parseInt(runFlags.port, 10)
      }
    }
    // @ts-ignore
    const app = express()
    app.use(express.static('.'))

    // POST route to save config
    app.use(express.json())
    app.post(
      '/updateConfig',
      async (req: express.Request, res: express.Response) => {
        this.debug('Req body: ', req.body)

        if (req.body.adminKey === adminKey) {
          this.debug('Admin key matches')
          try {
            await this.writeJsonFile(this.target, req.body.config)
            res.send('Config written to disk')
          } catch {
            res.status(500).send('Could not write config file')
          }
        } else {
          res.status(403).send('Admin key does not match')
        }
      },
    )

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
    this.log(
      `Navigate to http://localhost:${port}?adminKey=${adminKey} to configure your JBrowse installation graphically.`,
    )
  }
}
