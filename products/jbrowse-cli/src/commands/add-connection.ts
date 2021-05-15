import { flags } from '@oclif/command'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import parseJSON from 'json-parse-better-errors'
import JBrowseCommand from '../base'

const fsPromises = fs.promises
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

export default class AddConnection extends JBrowseCommand {
  // @ts-ignore
  private target: string

  static description = 'Add a connection to a JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-connection http://mysite.com/jbrowse/data/',
    '$ jbrowse add-connection http://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection',
    '$ jbrowse add-connection http://mysite.com/path/to/hub.txt --assemblyName hg19',
    '$ jbrowse add-connection http://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection --assemblyName hg19',
    `$ jbrowse add-connection http://mysite.com/path/to/custom --type custom --config '{"uri":{"url":"https://mysite.com/path/to/custom"}}' --assemblyName hg19`,
    '$ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target /path/to/jb2/installation/config.json',
  ]

  static args = [
    {
      name: 'connectionUrlOrPath',
      required: true,
      description: `URL of data directory\nFor hub file, usually called hub.txt\nFor JBrowse 1, location of JB1 data directory similar to http://mysite.com/jbrowse/data/ `,
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description:
        'type of connection, ex. JBrowse1Connection, UCSCTrackHubConnection, custom',
    }),
    assemblyName: flags.string({
      char: 'a',
      description:
        'Assembly name of the connection If none, will default to the assembly in your config file',
    }),
    config: flags.string({
      char: 'c',
      description: `Any extra config settings to add to connection in JSON object format, such as '{"uri":"url":"https://sample.com"}}'`,
    }),
    connectionId: flags.string({
      description: `Id for the connection that must be unique to JBrowse.  Defaults to 'connectionType-assemblyName-currentTime'`,
    }),
    name: flags.string({
      char: 'n',
      description:
        'Name of the connection. Defaults to connectionId if not provided',
    }),
    target: flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.',
    }),
    out: flags.string({
      description: 'synonym for target',
    }),
    help: flags.help({ char: 'h' }),
    skipCheck: flags.boolean({
      description:
        "Don't check whether or not the data directory URL exists or if you are in a JBrowse directory",
    }),
    overwrite: flags.boolean({
      description: 'Overwrites any existing connections if same connection id',
    }),
    force: flags.boolean({
      char: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddConnection)

    const output = runFlags.target || runFlags.out || '.'
    const isDir = (await fsPromises.lstat(output)).isDirectory()
    this.target = isDir ? `${output}/config.json` : output

    const { connectionUrlOrPath: argsPath } = runArgs as {
      connectionUrlOrPath: string
    }
    const { config } = runFlags
    let { type, name, connectionId, assemblyName } = runFlags
    const url = await this.resolveURL(
      argsPath,
      !(runFlags.skipCheck || runFlags.force),
    )

    const configContents: Config = await this.readJsonFile(this.target)
    this.debug(`Using config file ${this.target}`)

    if (!configContents.assemblies || !configContents.assemblies.length) {
      this.error(
        'No assemblies found. Please add one before adding connections',
        { exit: 120 },
      )
    } else if (configContents.assemblies.length > 1 && !assemblyName) {
      this.error(
        'Too many assemblies, cannot default to one. Please specify the assembly with the --assemblyNames flag',
      )
    }

    if (assemblyName) {
      configContents.assemblies.findIndex(
        assemblies => assemblies.name === assemblyName,
      ) === -1
        ? this.error(
            `Assembly name provided does not match any in config. Valid assembly names are ${configContents.assemblies.map(
              assembly => assembly.name,
            )}`,
            { exit: 130 },
          )
        : this.debug(`Assembly name(s) is :${assemblyName}`)
    } else {
      assemblyName = configContents.assemblies[0].name
      this.log(`Inferred default assembly name ${assemblyName}`)
    }

    if (type) {
      this.debug(`Type is ${type}`)
    } else {
      type = this.determineConnectionType(url, config)
    }
    if (connectionId) {
      this.debug(`Connection id is ${connectionId}`)
    } else {
      connectionId = `${type}-${assemblyName}-${Date.now()}`
    }

    if (name) {
      this.debug(`Name is: ${name}`)
    } else {
      name = connectionId
    }

    let configObj = {}
    if (config) {
      try {
        configObj = parseJSON(config)
      } catch (error) {
        this.error('Could not parse provided JSON object')
      }
    }
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
        if (!config || !this.isValidJSON(config)) {
          this.error(
            'When type is not UCSCTrackHubConnection or JBrowse1Connection, config object must be provided.\nPlease enter a config object using --config',
            { exit: 140 },
          )
        }

        break
      }
    }

    if (!configContents.connections) {
      configContents.connections = []
    }
    const idx = configContents.connections.findIndex(
      configConnection => configConnection.connectionId === connectionId,
    )

    if (idx !== -1) {
      this.debug(`Found existing connectionId ${connectionId} in configuration`)
      if (runFlags.force || runFlags.overwrite) {
        this.debug(`Overwriting connection ${connectionId} in configuration`)
        configContents.connections[idx] = connectionConfig
      } else {
        this.error(
          `Cannot add connection with id ${connectionId}, a connection with that id already exists.\nUse --overwrite if you would like to replace the existing connection`,
          { exit: 150 },
        )
      }
    } else {
      configContents.connections.push(connectionConfig)
    }

    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, configContents)

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} connection "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }

  async resolveURL(location: string, check = true) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      this.error('The location provided is not a valid URL', { exit: 160 })
    }
    if (locationUrl) {
      let response
      try {
        if (check) {
          response = await fetch(locationUrl, { method: 'HEAD' })
        }
        if (!response || response.ok) {
          return locationUrl.href
        }
        this.error(`Response returned with code ${response.status}`)
      } catch (error) {
        // ignore
        this.error(`Unable to fetch from URL, ${error}`, { exit: 170 })
      }
    }
    return this.error(`Could not resolve to a URL: "${location}"`, {
      exit: 180,
    })
  }

  determineConnectionType(url: string, config: string | undefined) {
    if (path.basename(url) === 'hub.txt') {
      return 'UCSCTrackHubConnection'
    }
    if (url.includes('jbrowse/data')) {
      return 'JBrowse1Connection'
    }
    if (config && this.isValidJSON(config)) {
      return 'custom'
    }
    return this.error(
      `Unable to determine a specific connection from URL given.\nPlease specify a type with --type.\nIf you want a custom type, please provide the config object with --config`,
    )
  }

  isValidJSON(str: string) {
    try {
      JSON.parse(str)
      return true
    } catch (error) {
      return false
    }
  }
}
