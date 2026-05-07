import path from 'path'
import { parseArgs } from 'util'

import parseJSON from 'json-parse-better-errors'

import { debug, printHelp, readJsonFile, resolveConfigPath } from '../utils.ts'
import {
  findAndUpdateOrAdd,
  saveConfigAndReport,
} from './shared/config-operations.ts'

import type { Config } from '../base.ts'

function resolveURL(location: string) {
  try {
    return new URL(location).href
  } catch (error) {
    throw new Error(`The location ${location} provided is not a valid URL`, {
      cause: error,
    })
  }
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
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Overwrite existing connection if one with the same id exists',
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
    throw new Error(
      'Missing required argument: connectionUrlOrPath\nUsage: jbrowse add-connection <connectionUrlOrPath> [options]',
    )
  }

  const target = await resolveConfigPath(flags.target, flags.out)

  const { assemblyNames, type, name, config, connectionId, force } = flags

  const url = resolveURL(connectionUrlOrPath)
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
    [configType, assemblyNames, Date.now()].filter(Boolean).join('-')

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

  const { updatedItems: connections, wasOverwritten } = findAndUpdateOrAdd({
    items: configContents.connections ?? [],
    newItem: connectionConfig,
    idField: 'connectionId',
    getId: item => item.connectionId,
    force: force ?? false,
    itemType: 'connection',
  })

  await saveConfigAndReport({
    config: { ...configContents, connections },
    target,
    itemType: 'connection',
    itemName: name || id,
    itemId: id,
    wasOverwritten,
  })
}
