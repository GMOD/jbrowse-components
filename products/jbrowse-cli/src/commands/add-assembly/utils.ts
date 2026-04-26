import fs from 'fs'
import path from 'path'

import { isURL } from '../../types/common.ts'
import {
  debug,
  readInlineOrFileJson,
  readJsonFile,
  resolveFileLocation,
} from '../../utils.ts'
import { findAndUpdateOrAdd } from '../shared/config-operations.ts'

import type { Assembly, Config, Sequence } from '../../base.ts'

interface AssemblyFlags {
  type?: string
  name?: string
  alias?: string[]
  displayName?: string
  faiLocation?: string
  gziLocation?: string
  refNameAliases?: string
  refNameAliasesType?: string
  refNameColors?: string
  load?: string
  skipCheck?: boolean
  overwrite?: boolean
  force?: boolean
}

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

async function maybeLoad(locs: [string, string], load: string | undefined, target: string): Promise<[string, string]>
async function maybeLoad(locs: [string, string, string], load: string | undefined, target: string): Promise<[string, string, string]>
async function maybeLoad(locs: string[], load: string | undefined, target: string): Promise<string[]> {
  if (!load) {
    return locs
  }
  const loaded = await loadData({ load, filePaths: locs, destination: target })
  return loaded ? locs.map(p => path.basename(p)) : locs
}

async function maybeLoadOne(loc: string, load: string | undefined, target: string): Promise<string> {
  if (!load) {
    return loc
  }
  const loaded = await loadData({ load, filePaths: [loc], destination: target })
  return loaded ? path.basename(loc) : loc
}

export async function getAssembly({
  runFlags,
  argsSequence,
  target,
}: {
  runFlags: AssemblyFlags
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

  const { skipCheck, force, load, faiLocation, gziLocation } = runFlags
  const check = !(skipCheck || force)
  const inPlace = load === 'inPlace'

  switch (type) {
    case 'indexedFasta': {
      let seqLoc = await resolveFileLocation(argsSequence, check, inPlace)
      let idxLoc = await resolveFileLocation(
        faiLocation || `${argsSequence}.fai`,
        check,
        inPlace,
      )
      debug(`FASTA: ${seqLoc}, index: ${idxLoc}`)
      if (!name) {
        name = path.basename(seqLoc, seqLoc.endsWith('.fasta') ? '.fasta' : '.fa')
        debug(`Guessing name: ${name}`)
      }
      ;[seqLoc, idxLoc] = await maybeLoad([seqLoc, idxLoc], load, target)
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { uri: seqLoc, locationType: 'UriLocation' },
          faiLocation: { uri: idxLoc, locationType: 'UriLocation' },
        },
      }
      break
    }
    case 'bgzipFasta': {
      let seqLoc = await resolveFileLocation(argsSequence, check, inPlace)
      let idxLoc = await resolveFileLocation(
        faiLocation || `${seqLoc}.fai`,
        check,
        inPlace,
      )
      let gziLoc = await resolveFileLocation(
        gziLocation || `${seqLoc}.gzi`,
        check,
        inPlace,
      )
      debug(`bgzipFASTA: ${seqLoc}, fai: ${idxLoc}, gzi: ${gziLoc}`)
      if (!name) {
        name = path.basename(seqLoc, seqLoc.endsWith('.fasta.gz') ? '.fasta.gz' : '.fa.gz')
        debug(`Guessing name: ${name}`)
      }
      ;[seqLoc, idxLoc, gziLoc] = await maybeLoad([seqLoc, idxLoc, gziLoc], load, target)
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: { uri: seqLoc, locationType: 'UriLocation' },
          faiLocation: { uri: idxLoc, locationType: 'UriLocation' },
          gziLocation: { uri: gziLoc, locationType: 'UriLocation' },
        },
      }
      break
    }
    case 'twoBit': {
      const seqLoc = await maybeLoadOne(
        await resolveFileLocation(argsSequence, check, inPlace),
        load,
        target,
      )
      debug(`2bit: ${seqLoc}`)
      if (!name) {
        name = path.basename(seqLoc, '.2bit')
        debug(`Guessing name: ${name}`)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: { uri: seqLoc, locationType: 'UriLocation' },
        },
      }
      break
    }
    case 'chromSizes': {
      const seqLoc = await maybeLoadOne(
        await resolveFileLocation(argsSequence, check, inPlace),
        load,
        target,
      )
      debug(`chrom.sizes: ${seqLoc}`)
      if (!name) {
        name = path.basename(seqLoc, '.chrom.sizes')
        debug(`Guessing name: ${name}`)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'ChromSizesAdapter',
          chromSizesLocation: { uri: seqLoc, locationType: 'UriLocation' },
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

export async function resolveTargetPath(output: string): Promise<string> {
  const stat = await fs.promises.stat(output).catch(() => null)
  if (!stat) {
    const dir = output.endsWith('.json') ? path.dirname(output) : output
    await fs.promises.mkdir(dir, { recursive: true })
  }
  const finalStat = stat ?? (await fs.promises.stat(output).catch(() => null))
  return finalStat?.isDirectory() ? path.join(output, 'config.json') : output
}

async function resolveRefNameAliasAdapter(runFlags: AssemblyFlags) {
  if (runFlags.refNameAliasesType === 'custom') {
    const config = await readInlineOrFileJson<{ type: string }>(runFlags.refNameAliases!)
    if (!config.type) {
      throw new Error(
        `No "type" specified in refNameAliases adapter "${JSON.stringify(config)}"`,
      )
    }
    debug(`Adding custom refNameAliases config: ${JSON.stringify(config)}`)
    return config
  }
  const location = await resolveFileLocation(
    runFlags.refNameAliases!,
    !(runFlags.skipCheck || runFlags.force),
    runFlags.load === 'inPlace',
  )
  debug(`refName aliases file location resolved to: ${location}`)
  return { type: 'RefNameAliasAdapter', location: { uri: location, locationType: 'UriLocation' } }
}

export async function enhanceAssembly(
  assembly: Assembly,
  runFlags: AssemblyFlags,
): Promise<Assembly> {
  return {
    ...assembly,
    ...(runFlags.alias?.length && { aliases: runFlags.alias }),
    ...(runFlags.refNameColors && {
      refNameColors: runFlags.refNameColors.split(',').map(c => c.trim()),
    }),
    ...(runFlags.displayName && { displayName: runFlags.displayName }),
    ...(runFlags.refNameAliases && {
      refNameAliases: { adapter: await resolveRefNameAliasAdapter(runFlags) },
    }),
  }
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
  runFlags: AssemblyFlags
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

