import fs from 'fs'
import path from 'path'
import { readJsonFile, writeJsonFile } from './util.js'
import type { Assembly, Sequence, Config } from './types.js'
const { realpath, rename, copyFile, mkdir, symlink } = fs.promises

async function loadData(
  load: string,
  filePaths: string[],
  destination: string,
) {
  let locationUrl: URL | undefined
  try {
    locationUrl = new URL(filePaths[0])
  } catch (error) {
    // ignore
  }

  if (locationUrl) {
    return false
  }
  switch (load) {
    case 'copy': {
      await Promise.all(
        filePaths.map(async filePath => {
          if (!filePath) {
            return undefined
          }
          return copyFile(
            filePath,
            path.join(path.dirname(destination), path.basename(filePath)),
          )
        }),
      )
      return true
    }
    case 'symlink': {
      await Promise.all(
        filePaths.map(async filePath => {
          if (!filePath) {
            return undefined
          }
          return symlink(
            path.resolve(filePath),
            path.join(path.dirname(destination), path.basename(filePath)),
          )
        }),
      )
      return true
    }
    case 'move': {
      await Promise.all(
        filePaths.map(async filePath => {
          if (!filePath) {
            return undefined
          }
          return rename(
            filePath,
            path.join(path.dirname(destination), path.basename(filePath)),
          )
        }),
      )
      return true
    }
    case 'inPlace': {
      return false
    }
  }
  return false
}

async function resolveFileLocation(
  location: string,
  check = true,
  inPlace = false,
) {
  let locationUrl: URL | undefined
  try {
    locationUrl = new URL(location)
  } catch (error) {
    // ignore
  }
  if (locationUrl) {
    if (check) {
      const response = await fetch(locationUrl, { method: 'HEAD' })
      if (!response.ok) {
        throw new Error(`${locationUrl} result ${response.statusText}`)
      }
    }
    return locationUrl.href
  }
  let locationPath: string | undefined
  try {
    locationPath = check ? await realpath(location) : location
  } catch (e) {
    // ignore
  }
  if (locationPath) {
    const filePath = path.relative(process.cwd(), locationPath)
    if (inPlace && filePath.startsWith('..')) {
      console.warn(
        `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
      )
    }
    return inPlace ? location : filePath
  }
  throw new Error(`Could not resolve to a file or a URL: "${location}"`)
}

function needLoadData(location: string) {
  let locationUrl: URL | undefined
  try {
    locationUrl = new URL(location)
  } catch (error) {
    // ignore
  }
  if (locationUrl) {
    return false
  }
  return true
}

async function readInlineOrFileJson(inlineOrFileName: string) {
  let result
  // see if it's inline JSON
  try {
    result = JSON.parse(inlineOrFileName)
  } catch (error) {
    // not inline JSON, must be location of a JSON file
    result = await readJsonFile(inlineOrFileName)
  }
  return result
}

function isValidJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (error) {
    return false
  }
}

function guessSequenceType(sequence: string) {
  if (
    sequence.endsWith('.fa') ||
    sequence.endsWith('.fna') ||
    sequence.endsWith('.fasta')
  ) {
    return 'indexedFasta'
  }
  if (
    sequence.endsWith('.fa.gz') ||
    sequence.endsWith('.fna.gz') ||
    sequence.endsWith('.fasta.gz')
  ) {
    return 'bgzipFasta'
  }
  if (sequence.endsWith('.2bit')) {
    return 'twoBit'
  }
  if (sequence.endsWith('.chrom.sizes')) {
    return 'chromSizes'
  }
  if (sequence.endsWith('.json')) {
    return 'custom'
  }
  if (isValidJSON(sequence)) {
    return 'custom'
  }
  throw new Error(
    'Could not determine sequence type automatically, add --type to specify it',
  )
}

async function getAssembly({
  skipCheck,
  force,
  faiLocation,
  gziLocation,
  load,
  name,
  type,
  sequence: argsSequence = '',
  outFile,
}: {
  skipCheck?: boolean
  force?: boolean
  faiLocation?: string
  gziLocation?: string
  type?: string
  name?: string
  load?: string
  sequence?: string
  outFile: string
}) {
  if (needLoadData(argsSequence) && !load) {
    throw new Error(
      `Please specify the loading operation for this file with --load copy|symlink|move|inPlace`,
    )
  } else if (!needLoadData(argsSequence) && load) {
    throw new Error(
      `URL detected with --load flag. Please rerun the function without the --load flag`,
    )
  }

  if (!type) {
    type = guessSequenceType(argsSequence)
  }
  switch (type) {
    case 'indexedFasta': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(skipCheck || force),
        load === 'inPlace',
      )

      let indexLocation = await resolveFileLocation(
        faiLocation || `${argsSequence}.fai`,
        !(skipCheck || force),
        load === 'inPlace',
      )

      if (!name) {
        name = path.basename(
          sequenceLocation,
          sequenceLocation.endsWith('.fasta') ? '.fasta' : '.fa',
        )
      }
      const loaded = load
        ? await loadData(load, [sequenceLocation, indexLocation], outFile)
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
        indexLocation = path.basename(indexLocation)
      }
      return {
        name,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation: {
              uri: sequenceLocation,
              locationType: 'UriLocation',
            },
            faiLocation: { uri: indexLocation, locationType: 'UriLocation' },
          },
        },
      } as const
    }
    case 'bgzipFasta': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(skipCheck || force),
        load === 'inPlace',
      )

      let indexLocation = await resolveFileLocation(
        faiLocation || `${sequenceLocation}.fai`,
        !(skipCheck || force),
        load === 'inPlace',
      )

      let bgzipIndexLocation = await resolveFileLocation(
        gziLocation || `${sequenceLocation}.gzi`,
        !(skipCheck || force),
        load === 'inPlace',
      )

      if (!name) {
        name = path.basename(
          sequenceLocation,
          sequenceLocation.endsWith('.fasta.gz') ? '.fasta.gz' : '.fa.gz',
        )
      }
      const loaded = load
        ? await loadData(
            load,
            [sequenceLocation, indexLocation, bgzipIndexLocation],
            outFile,
          )
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
        indexLocation = path.basename(indexLocation)
        bgzipIndexLocation = path.basename(bgzipIndexLocation)
      }
      return {
        name,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'BgzipFastaAdapter',
            fastaLocation: {
              uri: sequenceLocation,
              locationType: 'UriLocation',
            },
            faiLocation: { uri: indexLocation, locationType: 'UriLocation' },
            gziLocation: {
              uri: bgzipIndexLocation,
              locationType: 'UriLocation',
            },
          },
        },
      } as const
    }
    case 'twoBit': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(skipCheck || force),
        load === 'inPlace',
      )

      if (!name) {
        name = path.basename(sequenceLocation, '.2bit')
      }
      const loaded = load
        ? await loadData(load, [sequenceLocation], outFile)
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
      }
      return {
        name,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: {
              uri: sequenceLocation,
              locationType: 'UriLocation',
            },
          },
        },
      } as const
    }
    case 'chromSizes': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(skipCheck || force),
        load === 'inPlace',
      )

      if (!name) {
        name = path.basename(sequenceLocation, '.chrom.sizes')
      }
      const loaded = load
        ? await loadData(load, [sequenceLocation], outFile)
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
      }
      return {
        name,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'ChromSizesAdapter',
            chromSizesLocation: {
              uri: sequenceLocation,
              locationType: 'UriLocation',
            },
          },
        },
      } as const
    }
    case 'custom': {
      const adapter = await readInlineOrFileJson(argsSequence)

      if (!name) {
        if (isValidJSON(argsSequence)) {
          throw new Error(
            'Must provide --name when using custom inline JSON sequence',
          )
        } else {
          name = path.basename(argsSequence, '.json')
        }
      }
      if (!('type' in adapter)) {
        throw new Error(
          `No "type" specified in sequence adapter "${JSON.stringify(
            adapter,
          )}"`,
        )
      }
      return {
        name,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter,
        },
      } as const
    }
  }
  throw new Error('Unrecognized sequence type')
}

async function getRefNameAliasesAdapter({
  refNameAliasesType,
  refNameAliases,
  skipCheck,
  load,
  force,
}: {
  refNameAliases?: string
  refNameAliasesType?: string
  skipCheck?: boolean
  load?: string
  force?: boolean
}) {
  if (refNameAliases) {
    if (refNameAliasesType && refNameAliasesType === 'custom') {
      const refNameAliasesConfig = await readInlineOrFileJson(refNameAliases)
      if (!refNameAliasesConfig.type) {
        throw new Error(
          `No "type" specified in refNameAliases adapter "${JSON.stringify(
            refNameAliasesConfig,
          )}"`,
        )
      }

      return {
        adapter: refNameAliasesConfig,
      }
    } else {
      const refNameAliasesLocation = await resolveFileLocation(
        refNameAliases,
        !(skipCheck || force),
        load === 'inPlace',
      )

      return {
        adapter: {
          type: 'RefNameAliasAdapter',
          location: {
            uri: refNameAliasesLocation,
            locationType: 'UriLocation',
          },
        },
      }
    }
  }
  return undefined
}

export async function addAssembly(args: {
  displayName?: string
  refNameAliases?: string
  refNameColors?: string
  refNameAliasesType?: string
  skipCheck?: boolean
  force?: boolean
  type?: string
  name?: string
  sequence?: string
  overwrite?: boolean
  load?: string
  target?: string
  out?: string
  a?: string
}) {
  const {
    skipCheck,
    displayName,
    force,
    overwrite,
    load,
    target,
    out,
    refNameAliases,
    refNameAliasesType,
    refNameColors,
    a: alias,
  } = args
  // https://stackoverflow.com/a/35008327/2129219
  const exists = (s: string) =>
    new Promise(r => fs.access(s, fs.constants.F_OK, e => r(!e)))

  const output = target || out || '.'

  if (!(await exists(output))) {
    const dir = output.endsWith('.json') ? path.dirname(output) : output
    await mkdir(dir, { recursive: true })
  }
  let isDir = false
  try {
    isDir = fs.statSync(output).isDirectory()
  } catch (e) {}
  const outFile = isDir ? path.join(output, 'config.json') : output

  const assembly = {
    ...(await getAssembly({ ...args, outFile })),
    aliases: alias?.split(',').map(a => a.trim()),
    refNameColors: refNameColors?.split(',').map(c => c.trim()),
    refNameAliases: await getRefNameAliasesAdapter(args),
    displayName,
  }

  const defaultConfig: Config = {
    assemblies: [],
    configuration: {},
    connections: [],
    defaultSession: {
      name: 'New Session',
    },
    tracks: [],
  }

  const configContents = fs.existsSync(outFile)
    ? {
        ...defaultConfig,
        ...(await readJsonFile<{}>(outFile)),
      }
    : { ...defaultConfig }

  if (!configContents.assemblies) {
    configContents.assemblies = []
  }
  const idx = configContents.assemblies.findIndex(
    configAssembly => configAssembly.name === assembly.name,
  )
  if (idx !== -1) {
    if (overwrite || force) {
      configContents.assemblies[idx] = assembly
    } else {
      throw new Error(
        `Cannot add assembly with name ${assembly.name}, an assembly with that name already exists`,
      )
    }
  } else {
    configContents.assemblies.push(assembly)
  }

  await writeJsonFile(outFile, configContents)

  console.log(
    `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${assembly.name}" ${
      idx !== -1 ? 'in' : 'to'
    } ${outFile}`,
  )
}

export function addAssemblyOptions() {
  return {
    type: {
      type: 'string',
      char: 't',
      description: `type of sequence, by default inferred from sequence file

indexedFasta   An index FASTA (e.g. .fa or .fasta) file;
               can optionally specify --faiLocation

bgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file;
               can optionally specify --faiLocation and/or --gziLocation

twoBit         A twoBit (e.g. .2bit) file

chromSizes     A chromosome sizes (e.g. .chrom.sizes) file

custom         Either a JSON file location or inline JSON that defines a custom
               sequence adapter; must provide --name if using inline JSON`,

      options: ['indexedFasta', 'bgzipFasta', 'twoBit', 'chromSizes', 'custom'],
    },
    n: {
      type: 'string',
      alias: 'name',
      description:
        'Name of the assembly; if not specified, will be guessed using the sequence file name',
    },
    a: {
      type: 'string',
      alias: 'alias',
      description:
        'An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38");\ncan be specified multiple times',
      multiple: true,
    },
    displayName: {
      type: 'string',
      description:
        'The display name to specify for the assembly, e.g. "Homo sapiens (hg38)" while the name can be a shorter identifier like "hg38"',
    },
    faiLocation: {
      type: 'string',
      description: '[default: <fastaLocation>.fai] FASTA index file or URL',
    },
    gziLocation: {
      type: 'string',
      description:
        '[default: <fastaLocation>.gzi] FASTA gzip index file or URL',
    },
    refNameAliases: {
      type: 'string',
      description:
        'Reference sequence name aliases file or URL; assumed to be a tab-separated aliases\nfile unless --refNameAliasesType is specified',
    },
    refNameAliasesType: {
      type: 'string',
      description:
        'Type of aliases defined by --refNameAliases; if "custom", --refNameAliases is either\na JSON file location or inline JSON that defines a custom sequence adapter',
      options: ['aliases', 'custom'],
    },
    refNameColors: {
      type: 'string',
      description:
        'A comma-separated list of color strings for the reference sequence names; will cycle\nthrough colors if there are fewer colors than sequences',
    },
    target: {
      type: 'string',
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
    },
    out: { type: 'string', description: 'synonym for target' },
    load: {
      type: 'string',
      char: 'l',
      description:
        'Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data directory to the JBrowse directory. Or use inPlace to modify the config without doing any file operations',
      options: ['copy', 'symlink', 'move', 'inPlace'],
    },
    skipCheck: {
      type: 'boolean',
      description:
        "Don't check whether or not the sequence file or URL exists or if you are in a JBrowse directory",
    },
    overwrite: {
      type: 'boolean',
      description:
        'Overwrite existing assembly if one with the same name exists',
    },
    f: {
      type: 'boolean',
      alias: 'force',
      description: 'Equivalent to `--skipCheck --overwrite`',
    },
  } as const
}
