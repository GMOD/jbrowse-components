import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

export default class AddConnection extends Command {
  static description = 'Add a connection to a JBrowse 2 configuration'

  static examples = []

  static args = [
    {
      name: 'assemblyName',
      required: true,
      description: `Assembly name of the configuration to add to'`,
    },
    {
      name: 'dataDirectory',
      required: false,
      description: `Data directory URL`,
    },
    {
      name: 'location',
      required: false,
      description: 'Location of JBrowse installation. Defaults to .',
      default: '.',
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description: 'type of connection, ex. JBrowse 1 or UCSCTrackHub',
      default: 'custom',
    }),
    config: flags.string({
      char: 'c',
      description:
        'Any extra config settings to add to connection as JSON object format',
    }),
    name: flags.string({
      char: 'n',
      description: 'Name of the connection. Will be guessed on default',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddConnection)
    const { dataDirectory: argsPath } = runArgs as { dataDirectory: string }
    const { type, config, name } = runFlags

    await this.checkLocation(runArgs.location)
    await this.resolveURL(argsPath)
    // connection looks like
    //   new ConnectionType({
    //     name: 'MyConnection',
    //     configSchema: myConfigSchema,
    //     configEditorComponent: MyConfigComponent,
    //     stateModel: myModelFactory(pluginManager),
    //     displayName: 'My Awesome Connection',
    //     description:
    //       'Add tracks to JBrowse from data in the myAwesomeData format',
    //     url: '//mysite.com/info',
    //   }),

    // set up the connection obj like above
    // add it the the correct place
  }

  async checkLocation(location: string) {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile(
        path.join(location, 'manifest.json'),
        {
          encoding: 'utf8',
        },
      )
    } catch (error) {
      this.error(
        'Could not find the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 50 },
      )
    }
    let manifest: { name?: string } = {}
    try {
      manifest = JSON.parse(manifestJson)
    } catch (error) {
      this.error(
        'Could not parse the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 60 },
      )
    }
    if (manifest.name !== 'JBrowse') {
      this.error(
        '"name" in file "manifest.json" is not "JBrowse". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 70 },
      )
    }
  }

  async resolveURL(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      this.error('The location provided is not a valid URL', { exit: 10 })
    }
    if (locationUrl) {
      let response
      try {
        response = await fetch(locationUrl, { method: 'HEAD' })
        if (!response || response.ok) return locationUrl.href
      } catch (error) {
        // ignore
        this.error('Unable to fetch from URL', { exit: 20 })
      }
    }
    return this.error(`Could not resolve to a URL: "${location}"`, {
      exit: 30,
    })
  }
}
