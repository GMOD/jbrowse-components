import fs from 'fs'
import path from 'path'

import { isURL } from '../../types/common.ts'
import { debug, readInlineOrFileJson, readJsonFile } from '../../utils.ts'
import { mapLocationForFiles } from '../add-track-utils/track-config.ts'
import { findAndUpdateOrAdd } from '../shared/config-operations.ts'

import type { Assembly, Config, Sequence } from '../../base.ts'

export type SequenceType =
  | 'indexedFasta'
  | 'bgzipFasta'
  | 'twoBit'
  | 'chromSizes'
  | 'custom'

const sequenceTypes = new Set<SequenceType>([
  'indexedFasta',
  'bgzipFasta',
  'twoBit',
  'chromSizes',
  'custom',
])

export function isSequenceType(t: string | undefined): t is SequenceType {
  return sequenceTypes.has(t as SequenceType)
}

interface AssemblyFlags {
  type?: SequenceType
  name?: string
  alias?: string[]
  displayName?: string
  faiLocation?: string
  gziLocation?: string
  refNameAliases?: string
  refNameAliasesType?: string
  refNameColors?: string
  load?: string
  force?: boolean
}

export function isValidJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (error) {
    return false
  }
}

export function guessSequenceType(sequence: string) {
  const s = sequence.toLowerCase()
  if (
    s.endsWith('.fa') ||
    s.endsWith('.fna') ||
    s.endsWith('.fasta') ||
    s.endsWith('.mfa')
  ) {
    return 'indexedFasta'
  }
  if (
    s.endsWith('.fa.gz') ||
    s.endsWith('.fna.gz') ||
    s.endsWith('.fasta.gz') ||
    s.endsWith('.mfa.gz')
  ) {
    return 'bgzipFasta'
  }
  if (s.endsWith('.2bit')) {
    return 'twoBit'
  }
  if (s.endsWith('.chrom.sizes')) {
    return 'chromSizes'
  }
  if (s.endsWith('.json')) {
    return 'custom'
  }
  if (isValidJSON(sequence)) {
    return 'custom'
  }
  throw new Error(
    'Could not determine sequence type automatically, add --type to specify it',
  )
}

export async function getAssembly({
  runFlags,
  argsSequence,
}: {
  runFlags: AssemblyFlags
  argsSequence: string
}): Promise<{ assembly: Assembly; filesToLoad: string[] }> {
  if (!isURL(argsSequence) && !runFlags.load) {
    throw new Error(
      'Please specify the loading operation for this file with --load copy|symlink|move|inPlace',
    )
  } else if (isURL(argsSequence) && runFlags.load) {
    throw new Error(
      'URL detected with --load flag. Please rerun the function without the --load flag',
    )
  }

  let { name } = runFlags
  let { type } = runFlags
  if (type) {
    debug(`Type is: ${type}`)
  } else {
    type = guessSequenceType(argsSequence)
    debug(`No type specified, guessing type: ${type}`)
  }
  if (name) {
    debug(`Name is: ${name}`)
  }

  const { load, faiLocation, gziLocation } = runFlags
  const mapLoc = (p: string) => mapLocationForFiles(p, load)
  let sequence: Sequence
  let filesToLoad: string[] = []

  switch (type) {
    case 'indexedFasta': {
      const faiLoc = faiLocation || `${argsSequence}.fai`
      debug(`FASTA: ${argsSequence}, index: ${faiLoc}`)
      if (!name) {
        name = path.basename(
          argsSequence,
          argsSequence.endsWith('.fasta') ? '.fasta' : '.fa',
        )
        debug(`Guessing name: ${name}`)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: {
            uri: mapLoc(argsSequence),
            locationType: 'UriLocation',
          },
          faiLocation: { uri: mapLoc(faiLoc), locationType: 'UriLocation' },
        },
      }
      if (load) {
        filesToLoad = [argsSequence, faiLoc]
      }
      break
    }
    case 'bgzipFasta': {
      const faiLoc = faiLocation || `${argsSequence}.fai`
      const gziLoc = gziLocation || `${argsSequence}.gzi`
      debug(`bgzipFASTA: ${argsSequence}, fai: ${faiLoc}, gzi: ${gziLoc}`)
      if (!name) {
        name = path.basename(
          argsSequence,
          argsSequence.endsWith('.fasta.gz') ? '.fasta.gz' : '.fa.gz',
        )
        debug(`Guessing name: ${name}`)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation: {
            uri: mapLoc(argsSequence),
            locationType: 'UriLocation',
          },
          faiLocation: { uri: mapLoc(faiLoc), locationType: 'UriLocation' },
          gziLocation: { uri: mapLoc(gziLoc), locationType: 'UriLocation' },
        },
      }
      if (load) {
        filesToLoad = [argsSequence, faiLoc, gziLoc]
      }
      break
    }
    case 'twoBit': {
      debug(`2bit: ${argsSequence}`)
      if (!name) {
        name = path.basename(argsSequence, '.2bit')
        debug(`Guessing name: ${name}`)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: {
            uri: mapLoc(argsSequence),
            locationType: 'UriLocation',
          },
        },
      }
      if (load) {
        filesToLoad = [argsSequence]
      }
      break
    }
    case 'chromSizes': {
      debug(`chrom.sizes: ${argsSequence}`)
      if (!name) {
        name = path.basename(argsSequence, '.chrom.sizes')
        debug(`Guessing name: ${name}`)
      }
      sequence = {
        type: 'ReferenceSequenceTrack',
        trackId: `${name}-ReferenceSequenceTrack`,
        adapter: {
          type: 'ChromSizesAdapter',
          chromSizesLocation: {
            uri: mapLoc(argsSequence),
            locationType: 'UriLocation',
          },
        },
      }
      if (load) {
        filesToLoad = [argsSequence]
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

  return { assembly: { name, sequence }, filesToLoad }
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
    const config = await readInlineOrFileJson<{ type: string }>(
      runFlags.refNameAliases!,
    )
    if (!config.type) {
      throw new Error(
        `No "type" specified in refNameAliases adapter "${JSON.stringify(config)}"`,
      )
    }
    debug(`Adding custom refNameAliases config: ${JSON.stringify(config)}`)
    return config
  }
  const location = mapLocationForFiles(runFlags.refNameAliases!, runFlags.load)
  debug(`refName aliases file location: ${location}`)
  return {
    type: 'RefNameAliasAdapter',
    location: { uri: location, locationType: 'UriLocation' },
  }
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
    items: config.assemblies ?? [],
    newItem: assembly,
    idField: 'name',
    getId: item => item.name,
    force: runFlags.force ?? false,
    itemType: 'assembly',
  })

  return {
    config: { ...config, assemblies: updatedItems },
    wasOverwritten,
  }
}
