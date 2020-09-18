import { flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import JBrowseCommand, { Config } from '../base'

import express = require('express')

function isValidPort(port: number) {
  // potentially throw error here
  return port > 0 && port < 65535
}

// generate a string of random alphanumeric characters to serve as admin key
function generateKey() {
  return Math.random().toString(36).slice(2)
}

export default class AdminServer extends JBrowseCommand {
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
      default: './config.json',
    }),
    skipCheck: flags.boolean({
      description: "Don't check whether or not you are in a JBrowse directory",
    }),
    help: flags.help({ char: 'h' }),
  }

  async run() {
    const { flags: runFlags } = this.parse(AdminServer)

    if (!runFlags.skipCheck) {
      await this.checkLocation(path.dirname(runFlags.target))
    }

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

    let configContentsJson
    try {
      configContentsJson = await this.readJsonConfig(runFlags.target)
      this.debug(`Found existing config file ${runFlags.target}`)
    } catch (error) {
      this.debug('No existing config file found, creating default empty config')
      configContentsJson = JSON.stringify(defaultConfig, null, 4)
      await this.writeJsonConfig(configContentsJson)
    }

    // start server with admin key in URL query string
    let port = 9090
    if (runFlags.port && isValidPort(parseInt(runFlags.port, 10))) {
      port = parseInt(runFlags.port, 10)
    }
    const app = express()
    app.use(express.static('.'))

    // write POST route to save config
    app.use(express.json())
    app.post('/updateConfig', (req: express.Request, res: express.Response) => {
      this.debug('Req body: ', req.body)

      if (req.body.adminKey === adminKey) {
        this.debug('Admin key matches')
        try {
          fsPromises.writeFile(
            runFlags.target,
            JSON.stringify(req.body.config, null, 4),
          )
          res.send('Config written to disk')
        } catch {
          this.error('Could not write config file')
        }
      } else {
        this.error('Admin key does not match')
      }
    })

    // start listening, print URL to console
    const adminKey = generateKey()
    app.listen(port)
    this.log(
      `Navigate to http://localhost:${port}?adminKey=${adminKey} to configure your JBrowse installation graphically.`,
    )
  }
}
