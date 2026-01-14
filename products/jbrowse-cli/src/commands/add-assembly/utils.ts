import fs from 'fs'
import path from 'path'

import { isURL } from '../../types/common.ts'
import {
  debug,
  readInlineOrFileJson,
  readJsonFile,
  resolveFileLocation,
} from '../../utils.ts'
import {
  findAndUpdateOrAdd,
  saveConfigAndReport as saveConfigAndReportBase,
} from '../shared/config-operations.ts'

import type { Assembly, Config, Sequence } from '../../base.ts'

const { rename, copyFile, symlink } = fs.promises

export function isValidJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (error) {
    return false
  }
}

export function guessSequenceType(sequence: string) {
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

export function needLoadData(location: string) {
  return !isURL(location)
}

export async function loadData({
  load,
  filePaths,
  destination,
}: {
  load: string
  filePaths: string[]
  destination: string
}) {
  if (isURL(filePaths[0]!)) {
    return false
  }

  if (load === 'inPlace') {
    return false
  }

  const destDir = path.dirname(destination)
  const validPaths = filePaths.filter(f => !!f)

  const operations: Record<
    string,
    (src: string, dest: string) => Promise<void>
  > = {
    copy: copyFile,
    symlink: (src, dest) => symlink(path.resolve(src), dest),
    move: rename,
  }

  const operation = operations[load]
  if (operation) {
    await Promise.all(
      validPaths.map(filePath =>
        operation(filePath, path.join(destDir, path.basename(filePath))),
      ),
    )
    return true
  }

  return false
}

export async function getAssembly({
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
        ? await loadData({
            load,
            filePaths: [sequenceLocation, indexLocation],
            destination: target,
          })
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
        ? await loadData({
            load: runFlags.load,
            filePaths: [sequenceLocation, indexLocation, bgzipIndexLocation],
            destination: target,
          })
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
        ? await loadData({
            load: runFlags.load,
            filePaths: [sequenceLocation],
            destination: target,
          })
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
        ? await loadData({
            load: runFlags.load,
            filePaths: [sequenceLocation],
            destination: target,
          })
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

export async function exists(s: string): Promise<boolean> {
  try {
    await fs.promises.access(s, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function resolveTargetPath(output: string): Promise<string> {
  if (!(await exists(output))) {
    const dir = output.endsWith('.json') ? path.dirname(output) : output
    await fs.promises.mkdir(dir, { recursive: true })
  }

  let isDir = false
  try {
    isDir = fs.statSync(output).isDirectory()
  } catch (e) {}

  return isDir ? path.join(output, 'config.json') : output
}

export async function enhanceAssembly(
  assembly: Assembly,
  runFlags: any,
): Promise<Assembly> {
  const enhancedAssembly = { ...assembly }

  if (runFlags.alias?.length) {
    debug(`Adding assembly aliases: ${runFlags.alias}`)
    enhancedAssembly.aliases = runFlags.alias
  }

  if (runFlags.refNameColors) {
    enhancedAssembly.refNameColors = runFlags.refNameColors
      .split(',')
      .map((color: string) => color.trim())
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
      enhancedAssembly.refNameAliases = {
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
      enhancedAssembly.refNameAliases = {
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
    enhancedAssembly.displayName = runFlags.displayName
  }

  return enhancedAssembly
}

export function createDefaultConfig(): Config {
  return {
    assemblies: [],
    configuration: {},
    connections: [],
    defaultSession: {
      name: 'New Session',
    },
    tracks: [],
  }
}

export async function loadOrCreateConfig(target: string): Promise<Config> {
  const defaultConfig = createDefaultConfig()

  if (fs.existsSync(target)) {
    debug(`Found existing config file ${target}`)
    return {
      ...defaultConfig,
      ...(await readJsonFile(target)),
    }
  } else {
    debug(`Creating config file ${target}`)
    return { ...defaultConfig }
  }
}

export async function addAssemblyToConfig({
  config,
  assembly,
  runFlags,
}: {
  config: Config
  assembly: Assembly
  runFlags: any
}): Promise<{ config: Config; wasOverwritten: boolean }> {
  const { updatedItems, wasOverwritten } = findAndUpdateOrAdd({
    items: config.assemblies || [],
    newItem: assembly,
    idField: 'name',
    getId: item => item.name,
    allowOverwrite: runFlags.overwrite || runFlags.force || false,
    itemType: 'assembly',
  })

  return {
    config: { ...config, assemblies: updatedItems },
    wasOverwritten,
  }
}

export async function saveConfigAndReport({
  config,
  target,
  assembly,
  wasOverwritten,
}: {
  config: Config
  target: string
  assembly: Assembly
  wasOverwritten: boolean
}): Promise<void> {
  await saveConfigAndReportBase({
    config,
    target,
    itemType: 'assembly',
    itemName: assembly.name,
    wasOverwritten,
  })
}
