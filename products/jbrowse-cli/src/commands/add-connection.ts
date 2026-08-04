import { parseArgs } from 'node:util'

import {
  debug,
  parseCommaSeparatedString,
  printHelp,
  readConfigFile,
  requirePositional,
  resolveConfigPath,
} from '../utils.ts'
import { parseConfigFlag } from './add-track-utils/validators.ts'
import {
  findAndUpdateOrAdd,
  saveConfigAndReport,
} from './shared/config-operations.ts'

import type { Config, Connection } from '../base.ts'

function resolveURL(location: string) {
  try {
    return new URL(location)
  } catch (error) {
    throw new Error(`The location ${location} provided is not a valid URL`, {
      cause: error,
    })
  }
}

// a hub.txt filename and a jbrowse/data path are the two conventions we can
// recognize. Both are read off the URL's path rather than the whole href, so a
// query string can't fake one and a host that happens to be named hub.txt can't
// be mistaken for a hub file.
function determineConnectionType(url: URL) {
  if (url.pathname.endsWith('/hub.txt')) {
    return 'UCSCTrackHubConnection'
  }
  if (url.pathname.includes('jbrowse/data')) {
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
      description:
        'Overwrite existing connection if one with the same id exists',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Add a connection to a JBrowse 2 configuration'

  const usage = 'jbrowse add-connection <connectionUrlOrPath> [options]'

  const examples = [
    '# add a JBrowse 1 data directory connection (type inferred from the jbrowse/data path)',
    '$ jbrowse add-connection https://mysite.com/jbrowse/data/ -a hg19',
    '',
    '# force the JBrowse1Connection type for a non-standard data folder path',
    '$ jbrowse add-connection https://mysite.com/jbrowse/custom_data_folder/ --type JBrowse1Connection -a hg38',
    '',
    '# add a UCSC track hub (type inferred from the hub.txt filename)',
    '$ jbrowse add-connection https://mysite.com/path/to/hub.txt',
    '',
    '# force the UCSCTrackHubConnection type for a hub file not named hub.txt',
    '$ jbrowse add-connection https://mysite.com/path/to/custom_hub_name.txt --type UCSCTrackHubConnection',
    '',
    '# add a custom connection type with extra config',
    `$ jbrowse add-connection https://mysite.com/path/to/custom --type custom --config '{"uri":{"url":"https://mysite.com/path/to/custom"}, "locationType": "UriLocation"}' -a hg19`,
    '',
    '# set an explicit id/name and write to a specific config file',
    '$ jbrowse add-connection https://mysite.com/path/to/hub.txt --connectionId newId --name newName --target /path/to/jb2/installation/config.json',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage,
      options,
    })
    return
  }

  const connectionUrlOrPath = positionals[0]
  requirePositional(connectionUrlOrPath, 'connectionUrlOrPath', usage)

  const { assemblyNames, type, name, config, connectionId, force } = flags
  const configObj = config ? parseConfigFlag(config) : undefined

  const target = await resolveConfigPath(flags.target, flags.out)

  const url = resolveURL(connectionUrlOrPath)
  const configContents = await readConfigFile<Config>(target)
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

  // each known connection type stores the URL under its own location slot; a
  // custom type carries no location, so its --config must supply one
  const locationField = {
    UCSCTrackHubConnection: 'hubTxtLocation',
    JBrowse1Connection: 'dataDirLocation',
  }[configType]

  // a JBrowse 1 connection serves exactly one assembly, so it falls back to the
  // config's first (the assemblies list is known non-empty by here)
  const defaultAssemblyNames =
    configType === 'JBrowse1Connection'
      ? [configContents.assemblies[0]!.name]
      : undefined

  const connectionConfig: Connection = {
    type: configType,
    name: name || id,
    ...(locationField && {
      [locationField]: { uri: url.href, locationType: 'UriLocation' },
    }),
    connectionId: id,
    assemblyNames: assemblyNames
      ? parseCommaSeparatedString(assemblyNames)
      : defaultAssemblyNames,
    ...configObj,
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
