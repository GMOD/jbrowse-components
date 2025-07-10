import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import {
  debug,
  readJsonFile,
  writeJsonFile,
  resolveFileLocation,
  readInlineOrFileJson,
  printHelp,
} from '../utils'

import type { Assembly, Config, Sequence } from '../base'

const { rename, copyFile, mkdir, symlink } = fs.promises

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

async function loadData(
  load: string,
  filePaths: string[],
  destination: string,
) {
  let locationUrl: URL | undefined
  try {
    locationUrl = new URL(filePaths[0]!)
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

async function getAssembly({
  runFlags,
  argsSequence,
  target,
}: {
  runFlags: any
  argsSequence: string
  target: string
}): Promise<Assembly> {
  let sequence: Sequence

  if (needLoadData(argsSequence) && !runFlags.load) {
    throw new Error(
      'Please specify the loading operation for this file with --load copy|symlink|move|inPlace',
    )
  } else if (!needLoadData(argsSequence) && runFlags.load) {
    throw new Error(
      'URL detected with --load flag. Please rerun the function without the --load flag',
    )
  }

  let { name } = runFlags
  let { type } = runFlags as {
    type:
      | 'indexedFasta'
      | 'bgzipFasta'
      | 'twoBit'
      | 'chromSizes'
      | 'custom'
      | undefined
  }
  if (type) {
    debug(`Type is: ${type}`)
  } else {
    type = guessSequenceType(argsSequence)
    debug(`No type specified, guessing type: ${type}`)
  }
  if (name) {
    debug(`Name is: ${name}`)
  }
  switch (type) {
    case 'indexedFasta': {
      const { skipCheck, force, load, faiLocation } = runFlags
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(skipCheck || force),
        load === 'inPlace',
      )
      debug(`FASTA location resolved to: ${sequenceLocation}`)
      let indexLocation = await resolveFileLocation(
        faiLocation || `${argsSequence}.fai`,
        !(skipCheck || force),
        load === 'inPlace',
      )
      debug(`FASTA index location resolved to: ${indexLocation}`)
      if (!name) {
        name = path.basename(
          sequenceLocation,
          sequenceLocation.endsWith('.fasta') ? '.fasta' : '.fa',
        )
        debug(`Guessing name: ${name}`)
      }
      const loaded = load
        ? await loadData(load, [sequenceLocation, indexLocation], target)
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
        indexLocation = path.basename(indexLocation)
      }
      sequence = {
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
      }
      break
    }
    case 'bgzipFasta': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(runFlags.skipCheck || runFlags.force),
        runFlags.load === 'inPlace',
      )
      debug(`compressed FASTA location resolved to: ${sequenceLocation}`)
      let indexLocation = await resolveFileLocation(
        runFlags.faiLocation || `${sequenceLocation}.fai`,
        !(runFlags.skipCheck || runFlags.force),
        runFlags.load === 'inPlace',
      )
      debug(`compressed FASTA index location resolved to: ${indexLocation}`)
      let bgzipIndexLocation = await resolveFileLocation(
        runFlags.gziLocation || `${sequenceLocation}.gzi`,
        !(runFlags.skipCheck || runFlags.force),
        runFlags.load === 'inPlace',
      )
      debug(`bgzip index location resolved to: ${bgzipIndexLocation}`)
      if (!name) {
        name = path.basename(
          sequenceLocation,
          sequenceLocation.endsWith('.fasta.gz') ? '.fasta.gz' : '.fa.gz',
        )
        debug(`Guessing name: ${name}`)
      }
      const loaded = runFlags.load
        ? await loadData(
            runFlags.load,
            [sequenceLocation, indexLocation, bgzipIndexLocation],
            target,
          )
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
        indexLocation = path.basename(indexLocation)
        bgzipIndexLocation = path.basename(bgzipIndexLocation)
      }
      sequence = {
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
      }
      break
    }
    case 'twoBit': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(runFlags.skipCheck || runFlags.force),
        runFlags.load === 'inPlace',
      )
      debug(`2bit location resolved to: ${sequenceLocation}`)
      if (!name) {
        name = path.basename(sequenceLocation, '.2bit')
        debug(`Guessing name: ${name}`)
      }
      const loaded = runFlags.load
        ? await loadData(runFlags.load, [sequenceLocation], target)
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: {
            uri: sequenceLocation,
            locationType: 'UriLocation',
          },
        },
      }
      break
    }
    case 'chromSizes': {
      let sequenceLocation = await resolveFileLocation(
        argsSequence,
        !(runFlags.skipCheck || runFlags.force),
        runFlags.load === 'inPlace',
      )
      debug(`chrom.sizes location resolved to: ${sequenceLocation}`)
      if (!name) {
        name = path.basename(sequenceLocation, '.chrom.sizes')
        debug(`Guessing name: ${name}`)
      }
      const loaded = runFlags.load
        ? await loadData(runFlags.load, [sequenceLocation], target)
        : false
      if (loaded) {
        sequenceLocation = path.basename(sequenceLocation)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'ChromSizesAdapter',
          chromSizesLocation: {
            uri: sequenceLocation,
            locationType: 'UriLocation',
          },
        },
      }
      break
    }
    case 'custom': {
      const adapter = await readInlineOrFileJson<{ type: string }>(argsSequence)
      debug(`Custom adapter: ${JSON.stringify(adapter)}`)
      if (!name) {
        if (isValidJSON(argsSequence)) {
          throw new Error(
            'Must provide --name when using custom inline JSON sequence',
          )
        } else {
          name = path.basename(argsSequence, '.json')
        }
        debug(`Guessing name: ${name}`)
      }
      if (!('type' in adapter)) {
        throw new Error(
          `No "type" specified in sequence adapter "${JSON.stringify(
            adapter,
          )}"`,
        )
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter,
      }
      break
    }
  }

  return { name, sequence }
}

export async function run(args?: string[]) {
  // https://stackoverflow.com/a/35008327/2129219
  const exists = (s: string) =>
    new Promise(r => {
      fs.access(s, fs.constants.F_OK, e => {
        r(!e)
      })
    })

  const options = {
    type: {
      type: 'string',
      short: 't',
      description: `type of sequence, by default inferred from sequence file\n\nindexedFasta   An index FASTA (e.g. .fa or .fasta) file;\n               can optionally specify --faiLocation\n\nbgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file;\n               can optionally specify --faiLocation and/or --gziLocation\n\ntwoBit         A twoBit (e.g. .2bit) file\n\nchromSizes     A chromosome sizes (e.g. .chrom.sizes) file\n\ncustom         Either a JSON file location or inline JSON that defines a custom\n               sequence adapter; must provide --name if using inline JSON`,
      choices: ['indexedFasta', 'bgzipFasta', 'twoBit', 'chromSizes', 'custom'],
    },
    name: {
      type: 'string',
      short: 'n',
      description:
        'Name of the assembly; if not specified, will be guessed using the sequence file name',
    },
    alias: {
      type: 'string',
      short: 'a',
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
      choices: ['aliases', 'custom'],
      dependsOn: ['refNameAliases'],
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
    out: {
      type: 'string',
      description: 'synonym for target',
    },
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Display help for command',
    },
    load: {
      type: 'string',
      short: 'l',
      description:
        'Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data directory to the JBrowse directory. Or use inPlace to modify the config without doing any file operations',
      choices: ['copy', 'symlink', 'move', 'inPlace'],
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
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    },
  } as const
  const { positionals, values: runFlags } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Add an assembly to a JBrowse 2 configuration'

  const examples = [
    '# add assembly to installation in current directory. assumes .fai file also exists, and copies GRCh38.fa and GRCh38.fa.fai to current directory',
    '$ jbrowse add-assembly GRCh38.fa --load copy',
    '',
    '# add assembly to a specific jb2 installation path using --out, and copies the .fa and .fa.fai file to /path/to/jb2',
    '$ jbrowse add-assembly GRCh38.fa --out /path/to/jb2/ --load copy',
    '',
    '# force indexedFasta for add-assembly without relying on file extension',
    '$ jbrowse add-assembly GRCh38.xyz --type indexedFasta --load copy',
    '',
    '# add displayName for an assembly',
    '$ jbrowse add-assembly myFile.fa.gz --name hg38 --displayName "Homo sapiens (hg38)"',
    '',
    '# use chrom.sizes file for assembly instead of a fasta file',
    '$ jbrowse add-assembly GRCh38.chrom.sizes --load inPlace',
    '',
    '# add assembly from preconfigured json file, expert option',
    '$ jbrowse add-assembly GRCh38.config.json --load copy',
    '',
    '# add assembly from a 2bit file, also note pointing direct to a URL so no --load flag needed',
    '$ jbrowse add-assembly https://example.com/data/sample.2bit',
    '',
    '# add a bgzip indexed fasta inferred by fa.gz extension. assumes .fa.gz.gzi and .fa.gz.fai files also exists',
    '$ jbrowse add-assembly myfile.fa.gz --load copy',
  ]

  if (runFlags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse add-assembly <sequence> [options]',
      options,
    })
    return
  }

  const argsSequence = positionals[0] || ''
  const output = runFlags.target || runFlags.out || '.'

  if (!(await exists(output))) {
    const dir = output.endsWith('.json') ? path.dirname(output) : output
    await mkdir(dir, { recursive: true })
  }
  let isDir = false
  try {
    isDir = fs.statSync(output).isDirectory()
  } catch (e) {}
  const target = isDir ? path.join(output, 'config.json') : output

  debug(`Sequence location is: ${argsSequence}`)
  const { name } = runFlags

  const assembly = await getAssembly({ runFlags, argsSequence, target })
  if (runFlags.alias?.length) {
    debug(`Adding assembly aliases: ${runFlags.alias}`)
    assembly.aliases = runFlags.alias
  }

  if (runFlags.refNameColors) {
    assembly.refNameColors = runFlags.refNameColors
      .split(',')
      .map(color => color.trim())
  }

  if (runFlags.refNameAliases) {
    if (
      runFlags.refNameAliasesType &&
      runFlags.refNameAliasesType === 'custom'
    ) {
      const refNameAliasesConfig = await readInlineOrFileJson<{ type: string }>(
        runFlags.refNameAliases,
      )
      if (!refNameAliasesConfig.type) {
        throw new Error(
          `No "type" specified in refNameAliases adapter "${JSON.stringify(
            refNameAliasesConfig,
          )}"`,
        )
      }
      debug(
        `Adding custom refNameAliases config: ${JSON.stringify(
          refNameAliasesConfig,
        )}`,
      )
      assembly.refNameAliases = {
        adapter: refNameAliasesConfig,
      }
    } else {
      const refNameAliasesLocation = await resolveFileLocation(
        runFlags.refNameAliases,
        !(runFlags.skipCheck || runFlags.force),
        runFlags.load === 'inPlace',
      )
      debug(
        `refName aliases file location resolved to: ${refNameAliasesLocation}`,
      )
      assembly.refNameAliases = {
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

  if (runFlags.displayName) {
    assembly.displayName = runFlags.displayName
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

  let configContents: Config

  if (fs.existsSync(target)) {
    debug(`Found existing config file ${target}`)
    configContents = {
      ...defaultConfig,
      ...(await readJsonFile(target)),
    }
  } else {
    debug(`Creating config file ${target}`)
    configContents = { ...defaultConfig }
  }

  if (!configContents.assemblies) {
    configContents.assemblies = []
  }
  const idx = configContents.assemblies.findIndex(
    configAssembly => configAssembly.name === assembly.name,
  )
  if (idx !== -1) {
    debug(`Found existing assembly ${name} in configuration`)
    if (runFlags.overwrite || runFlags.force) {
      debug(`Overwriting assembly ${name} in configuration`)
      configContents.assemblies[idx] = assembly
    } else {
      throw new Error(
        `Cannot add assembly with name ${assembly.name}, an assembly with that name already exists`,
      )
    }
  } else {
    configContents.assemblies.push(assembly)
  }

  debug(`Writing configuration to file ${target}`)
  await writeJsonFile(target, configContents)

  console.log(
    `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${assembly.name}" ${
      idx !== -1 ? 'in' : 'to'
    } ${target}`,
  )
}
