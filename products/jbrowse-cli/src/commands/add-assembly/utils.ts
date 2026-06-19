import fs from 'fs'
import path from 'path'

import {
  debug,
  ignoreNotFound,
  parseCommaSeparatedString,
  readInlineOrFileJson,
  readJsonFile,
} from '../../utils.ts'
import { mapLocationForFiles } from '../add-track-utils/track-config.ts'
import { validateLoadAndLocation } from '../add-track-utils/validators.ts'
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

// recognized FASTA extensions, shared by sequence-type guessing and basename
// stripping so the list lives in one place
const fastaExts = 'fa|fna|fasta|mfa'
const fastaRegex = new RegExp(`\\.(${fastaExts})$`, 'i')
const bgzipFastaRegex = new RegExp(`\\.(${fastaExts})\\.gz$`, 'i')
const fastaExtRegex = new RegExp(`\\.(${fastaExts})(\\.gz)?$`, 'i')

function basenameWithoutFastaExt(p: string) {
  return path.basename(p).replace(fastaExtRegex, '')
}

export function guessSequenceType(sequence: string) {
  const s = sequence.toLowerCase()
  if (fastaRegex.test(s)) {
    return 'indexedFasta'
  }
  if (bgzipFastaRegex.test(s)) {
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
  validateLoadAndLocation(argsSequence, runFlags.load)

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
  const uri = (p: string) =>
    ({
      uri: mapLocationForFiles(p, load),
      locationType: 'UriLocation',
    }) as const

  let adapter: Sequence['adapter']
  let filesToLoad: string[] = []

  switch (type) {
    case 'indexedFasta': {
      const faiLoc = faiLocation || `${argsSequence}.fai`
      debug(`FASTA: ${argsSequence}, index: ${faiLoc}`)
      name ||= basenameWithoutFastaExt(argsSequence)
      adapter = {
        type: 'IndexedFastaAdapter',
        fastaLocation: uri(argsSequence),
        faiLocation: uri(faiLoc),
      }
      filesToLoad = [argsSequence, faiLoc]
      break
    }
    case 'bgzipFasta': {
      const faiLoc = faiLocation || `${argsSequence}.fai`
      const gziLoc = gziLocation || `${argsSequence}.gzi`
      debug(`bgzipFASTA: ${argsSequence}, fai: ${faiLoc}, gzi: ${gziLoc}`)
      name ||= basenameWithoutFastaExt(argsSequence)
      adapter = {
        type: 'BgzipFastaAdapter',
        fastaLocation: uri(argsSequence),
        faiLocation: uri(faiLoc),
        gziLocation: uri(gziLoc),
      }
      filesToLoad = [argsSequence, faiLoc, gziLoc]
      break
    }
    case 'twoBit': {
      debug(`2bit: ${argsSequence}`)
      name ||= path.basename(argsSequence, '.2bit')
      adapter = { type: 'TwoBitAdapter', twoBitLocation: uri(argsSequence) }
      filesToLoad = [argsSequence]
      break
    }
    case 'chromSizes': {
      debug(`chrom.sizes: ${argsSequence}`)
      name ||= path.basename(argsSequence, '.chrom.sizes')
      adapter = {
        type: 'ChromSizesAdapter',
        chromSizesLocation: uri(argsSequence),
      }
      filesToLoad = [argsSequence]
      break
    }
    case 'custom': {
      adapter = await readInlineOrFileJson<{ type: string }>(argsSequence)
      debug(`Custom adapter: ${JSON.stringify(adapter)}`)
      if (!name) {
        if (isValidJSON(argsSequence)) {
          throw new Error(
            'Must provide --name when using custom inline JSON sequence',
          )
        }
        name = path.basename(argsSequence, '.json')
      }
      if (!('type' in adapter)) {
        throw new Error(
          `No "type" specified in sequence adapter "${JSON.stringify(adapter)}"`,
        )
      }
      break
    }
  }

  const sequence: Sequence = {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}-ReferenceSequenceTrack`,
    adapter,
  }
  return { assembly: { name, sequence }, filesToLoad }
}

export async function resolveTargetPath(output: string): Promise<string> {
  const stat = await ignoreNotFound(fs.promises.stat(output))
  if (!stat) {
    const dir = output.endsWith('.json') ? path.dirname(output) : output
    await fs.promises.mkdir(dir, { recursive: true })
  }
  const finalStat = stat ?? (await ignoreNotFound(fs.promises.stat(output)))
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
      refNameColors: parseCommaSeparatedString(runFlags.refNameColors),
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
