import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

interface Connection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Config {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assemblies?: { name: string; sequence: { [key: string]: any } }[]
  configuration?: {}
  connections?: Connection[]
  defaultSession?: {}
  tracks?: unknown[]
}

export default class AddConnection extends Command {
  static description = 'Add a connection to a JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-connection hg19 http://mysite.com/jbrowse/data/',
    '$ jbrowse add-connection hg19 http://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection',
    '$ jbrowse add-connection hg19 http://mysite.com/path/to/hub.txt',
    '$ jbrowse add-connection hg19 http://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection',
    '$ jbrowse add-connection hg19 --type custom --config {config here}',
    '$ jbrowse add-connection hg19 https://mysite.com/path/to/hub.txt --connectionId newId --name newName',
  ]

  static args = [
    {
      // TODO: ask if assemblyname should be required or can guess the default
      name: 'assemblyName',
      required: true,
      description: `Assembly name of the configuration to add to'`,
    },
    {
      name: 'dataDirectory',
      required: true,
      description: `URL of data directory\nFor hub file, usually called hub.txt\nFor JBrowse 1, location of JB1 data directory similar to http://mysite.com/jbrowse/data/ `,
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
      description:
        'type of connection, ex. JBrowse1Connection, UCSCTrackHubConnection, custom',
    }),
    config: flags.string({
      char: 'c',
      description:
        'Any extra config settings to add to connection as JSON object format',
    }),
    configLocation: flags.string({
      description:
        'Write to a certain config.json file. Defaults to location/config.json if not specified',
    }),
    connectionId: flags.string({
      description:
        'Id for the connection, by default is type-assemblyName-dateAdded, must be unique to JBrowse',
    }),
    name: flags.string({
      char: 'n',
      description: 'Name of the connection. Will be guessed bu default',
    }),
    help: flags.help({ char: 'h' }),
    skipCheck: flags.boolean({
      description:
        "Don't check whether or not the file or URL exists or if you are in a JBrowse directory",
    }),
    overwrite: flags.boolean({
      description: 'Overwrites any existing tracks if same track id',
    }),
    force: flags.boolean({
      char: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddConnection)
    const { dataDirectory: argsPath } = runArgs as { dataDirectory: string }
    const { assemblyName } = runArgs
    const { config, configLocation } = runFlags
    let { type, name, connectionId } = runFlags

    const configPath =
      configLocation || path.join(runArgs.location, 'config.json')

    if (!(runFlags.skipCheck || runFlags.force)) {
      await this.checkLocation(runArgs.location)
    }

    const url = await this.resolveURL(
      argsPath,
      !(runFlags.skipCheck || runFlags.force),
    )

    let configContentsJson
    try {
      configContentsJson = await this.readJsonConfig(configPath)
      this.debug(`Found existing config file ${configPath}`)
    } catch (error) {
      this.error('No existing config file found', { exit: 10 })
    }
    let configContents: Config
    try {
      configContents = { ...JSON.parse(configContentsJson) }
    } catch (error) {
      this.error('Could not parse existing config file', { exit: 20 })
    }
    if (!configContents.assemblies || !configContents.assemblies.length) {
      this.error(
        'No assemblies found. Please add one before adding connections',
        {
          exit: 30,
        },
      )
    }

    if (
      configContents.assemblies.findIndex(
        assemblies => assemblies.name === assemblyName,
      ) === -1
    )
      this.error(
        `Assembly name provided does not match any in config. Valid assembly names are ${configContents.assemblies.map(
          assembly => assembly.name,
        )}`,
        { exit: 40 },
      )
    this.debug(`Assembly name(s) is :${assemblyName}`)

    if (type) {
      this.debug(`Type is ${type}`)
    } else {
      type = this.determineConnectionType(url)
    }
    if (connectionId) {
      this.debug(`Connection Id is ${connectionId}`)
    } else connectionId = `${type}-${assemblyName}-${Date.now()}`

    if (name) {
      this.debug(`Name is: ${name}`)
    } else name = connectionId

    let configObj = {}
    if (config) configObj = JSON.parse(config)
    const connectionConfig: Connection = {
      type,
      connectionId,
      name: name || connectionId,
      assemblyName,
      ...configObj,
    }

    switch (type) {
      case 'UCSCTrackHubConnection': {
        connectionConfig.hubTxtLocation = { uri: url }
        break
      }
      case 'JBrowse1Connection': {
        connectionConfig.dataDirLocation = { uri: url }
        break
      }
      default: {
        connectionConfig.url = { uri: url }
      }
    }

    if (!configContents.connections) {
      configContents.connections = []
    }
    const idx = configContents.connections.findIndex(
      configConnection => configConnection.connectionId === connectionId,
    )

    if (idx !== -1) {
      this.debug(
        `Found existing connectionkId ${connectionId} in configuration`,
      )
      if (runFlags.force || runFlags.overwrite) {
        this.debug(`Overwriting connection ${connectionId} in configuration`)
        configContents.connections[idx] = connectionConfig
      } else
        this.error(
          `Cannot add connection with id ${connectionId}, a connection with that id already exists.`,
          { exit: 40 },
        )
    } else configContents.connections.push(connectionConfig)

    this.debug(`Writing configuration to file ${configPath}`)
    await fsPromises.writeFile(
      configPath,
      JSON.stringify(configContents, undefined, 2),
    )

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} connection "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${configPath}`,
    )
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

  async resolveURL(location: string, check = true) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      this.error('The location provided is not a valid URL', { exit: 80 })
    }
    if (locationUrl) {
      let response
      try {
        if (check) {
          response = await fetch(locationUrl, { method: 'HEAD' })
        }
        if (!response || response.ok) return locationUrl.href
      } catch (error) {
        // ignore
        this.error('Unable to fetch from URL', { exit: 90 })
      }
    }
    return this.error(`Could not resolve to a URL: "${location}"`, {
      exit: 100,
    })
  }

  async readJsonConfig(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      const response = await fetch(locationUrl)
      return response.json()
    }
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }

  determineConnectionType(url: string) {
    if (path.basename(url) === 'hub.txt') return 'UCSCTrackHubConnection'
    if (url.includes('jbrowse/data')) return 'JBrowse1Connection'
    this.log(
      `Unable to determine a specific connection from URL given, setting type to custom.\nIf you know the type connection, rerun with --overwrite and specifiy type with --type`,
    )
    return 'custom'
  }
}
