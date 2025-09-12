import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import parseJSON from 'json-parse-better-errors'

import fetch from '../fetchWithProxy'
import { debug, printHelp, readJsonFile, writeJsonFile } from '../utils'

import type { Config } from '../base'

async function resolveURL(location: string, check = true) {
  let locationUrl: URL | undefined
  try {
    locationUrl = new URL(location)
  } catch (error) {
    throw new Error(`The location ${location} provided is not a valid URL`)
  }
  if (check) {
    const response = await fetch(`${locationUrl}`, { method: 'HEAD' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${locationUrl}`)
    }
  }
  return locationUrl.href
}

function determineConnectionType(url: string) {
  if (path.basename(url) === 'hub.txt') {
    return 'UCSCTrackHubConnection'
  }
  if (url.includes('jbrowse/data')) {
    return 'JBrowse1Connection'
  }
  return 'custom'
}

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    type: {
      type: 'string',
      short: 't',
      description:
        'Type of connection (e.g. JBrowse1Connection, UCSCTrackHubConnection, custom)',
    },
    assemblyNames: {
      type: 'string',
      short: 'a',
      description:
        'For UCSC: optional comma separated list of assembly names to filter. For JBrowse1: a single assembly name',
    },
    config: {
      type: 'string',
      short: 'c',
      description:
        'Extra config settings to add to connection in JSON object format',
    },
    connectionId: {
      type: 'string',
      description: 'Id for the connection that must be unique to JBrowse',
    },
    name: {
      type: 'string',
      short: 'n',
      description:
        'Name of the connection. Defaults to connectionId if not provided',
    },
    target: {
      type: 'string',
      description:
        'Path to config file in JB2 installation directory to write out to',
    },
    out: {
      type: 'string',
      description: 'Synonym for target',
    },
    skipCheck: {
      type: 'boolean',
      description: "Don't check whether the data directory URL exists",
    },
    overwrite: {
      type: 'boolean',
      description: 'Overwrites any existing connections if same connection id',
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Equivalent to --skipCheck --overwrite',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Add a connection to a JBrowse 2 configuration'

  const examples = [
    '$ jbrowse add-connection http://mysite.com/jbrowse/data/ -a hg19',
    '$ jbrowse add-connection http://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection -a hg38',
    '$ jbrowse add-connection http://mysite.com/path/to/hub.txt',
    '$ jbrowse add-connection http://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection',
    `$ jbrowse add-connection http://mysite.com/path/to/custom --type custom --config '{"uri":{"url":"https://mysite.com/path/to/custom"}, "locationType": "UriLocation"}' -a hg19`,
    '$ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target /path/to/jb2/installation/config.json',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse add-connection <connectionUrlOrPath> [options]',
      options,
    })
    return
  }

  const connectionUrlOrPath = positionals[0]
  if (!connectionUrlOrPath) {
    console.error('Error: Missing required argument: connectionUrlOrPath')
    console.error(
      'Usage: jbrowse add-connection <connectionUrlOrPath> [options]',
    )
    process.exit(1)
  }

  const output = flags.target || flags.out || '.'
  const isDir = fs.lstatSync(output).isDirectory()
  const target = isDir ? `${output}/config.json` : output

  const { assemblyNames, type, name, config, connectionId, skipCheck, force } =
    flags

  const url = await resolveURL(connectionUrlOrPath, !(skipCheck || force))
  const configContents = await readJsonFile<Config>(target)
  debug(`Using config file ${target}`)

  if (!configContents.assemblies?.length) {
    throw new Error(
      'No assemblies found. Please add one before adding connections',
    )
  }

  const configType = type || determineConnectionType(url)
  const id =
    connectionId ||
    [configType, assemblyNames, Date.now()].filter(f => !!f).join('-')

  const connectionConfig = {
    type: configType,
    name: name || id,
    ...(configType === 'UCSCTrackHubConnection'
      ? {
          hubTxtLocation: {
            uri: url,
            locationType: 'UriLocation',
          },
        }
      : {}),
    ...(configType === 'JBrowse1Connection'
      ? {
          dataDirLocation: {
            uri: url,
            locationType: 'UriLocation',
          },
        }
      : {}),
    connectionId: id,
    assemblyNames: assemblyNames
      ? assemblyNames.split(',')
      : type === 'JBrowse1Connection'
        ? [configContents.assemblies[0]?.name]
        : undefined,
    ...(config ? parseJSON(config) : {}),
  }

  if (!configContents.connections) {
    configContents.connections = []
  }
  const idx = configContents.connections.findIndex(
    c => c.connectionId === connectionId,
  )

  if (idx !== -1) {
    if (force || flags.overwrite) {
      configContents.connections[idx] = connectionConfig
    } else {
      throw new Error(
        `Cannot add connection with id ${connectionId}, a connection with that id already exists.\nUse --overwrite if you would like to replace the existing connection`,
      )
    }
  } else {
    configContents.connections.push(connectionConfig)
  }

  debug(`Writing configuration to file ${target}`)
  await writeJsonFile(target, configContents)

  console.log(
    `${idx !== -1 ? 'Overwrote' : 'Added'} connection "${name || id}" ${
      idx !== -1 ? 'in' : 'to'
    } ${target}`,
  )
}
