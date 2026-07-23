import fs from 'node:fs'
import path from 'node:path'

import { isURL } from '../../types/common.ts'
import {
  debug,
  ignoreNotFound,
  parseCommaSeparatedString,
  readInlineOrFileJson,
  readJsonFile,
} from '../../utils.ts'
import { mapLocationForFiles } from '../add-track-utils/track-config.ts'
import {
  parseConfigFlag,
  validateLoadAndLocation,
} from '../add-track-utils/validators.ts'
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

// parseArgs does not enforce the `choices` declared on --type, so an
// unrecognized value would otherwise be silently dropped and the type guessed
// from the file extension, masking a user typo
export function validateSequenceType(type?: string): void {
  if (type !== undefined && !isSequenceType(type)) {
    throw new Error(`--type must be one of: ${[...sequenceTypes].join(', ')}`)
  }
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
  config?: string
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

// a sidecar file sits next to the sequence at `${sequence}${suffix}`, unless
// the matching --faiLocation/--gziLocation flag overrides its path
interface SeqSidecar {
  field: 'faiLocation' | 'gziLocation'
  suffix: string
}

// declarative layout for each non-custom sequence type: the adapter type + its
// primary location field, any sidecar index files, and how the default assembly
// name is derived from the sequence filename. Keeping the adapter and its files
// in one spec means they cannot drift.
interface SeqSpec {
  adapterType: string
  locField: string
  sidecars: SeqSidecar[]
  defaultName: (p: string) => string
}

const seqSpecs: Record<Exclude<SequenceType, 'custom'>, SeqSpec> = {
  indexedFasta: {
    adapterType: 'IndexedFastaAdapter',
    locField: 'fastaLocation',
    sidecars: [{ field: 'faiLocation', suffix: '.fai' }],
    defaultName: basenameWithoutFastaExt,
  },
  bgzipFasta: {
    adapterType: 'BgzipFastaAdapter',
    locField: 'fastaLocation',
    sidecars: [
      { field: 'faiLocation', suffix: '.fai' },
      { field: 'gziLocation', suffix: '.gzi' },
    ],
    defaultName: basenameWithoutFastaExt,
  },
  twoBit: {
    adapterType: 'TwoBitAdapter',
    locField: 'twoBitLocation',
    sidecars: [],
    defaultName: p => path.basename(p, '.2bit'),
  },
  chromSizes: {
    adapterType: 'ChromSizesAdapter',
    locField: 'chromSizesLocation',
    sidecars: [],
    defaultName: p => path.basename(p, '.chrom.sizes'),
  },
}

async function customSequenceAdapter(argsSequence: string, name?: string) {
  const adapter = await readInlineOrFileJson<Sequence['adapter']>(argsSequence)
  debug(`Custom adapter: ${JSON.stringify(adapter)}`)
  if (!name) {
    if (isValidJSON(argsSequence)) {
      throw new Error(
        'Must provide --name when using custom inline JSON sequence',
      )
    }
    name = path.basename(argsSequence, '.json')
  }
  if (!adapter.type) {
    throw new Error(
      `No "type" specified in sequence adapter "${JSON.stringify(adapter)}"`,
    )
  }
  return { adapter, name }
}

export async function getAssembly({
  runFlags,
  argsSequence,
}: {
  runFlags: AssemblyFlags
  argsSequence: string
}): Promise<{ assembly: Assembly; filesToLoad: string[] }> {
  validateLoadAndLocation(argsSequence, runFlags.load)

  const type = runFlags.type ?? guessSequenceType(argsSequence)
  debug(
    runFlags.type ? `Type is: ${type}` : `No type specified, guessed: ${type}`,
  )

  const uri = (p: string) =>
    ({
      uri: mapLocationForFiles(p, runFlags.load),
      locationType: 'UriLocation',
    }) as const

  if (type === 'custom') {
    const { adapter, name } = await customSequenceAdapter(
      argsSequence,
      runFlags.name,
    )
    return {
      assembly: { name, sequence: makeSequence(name, adapter) },
      filesToLoad: [],
    }
  }

  const spec = seqSpecs[type]
  const sidecars = spec.sidecars.map(s => ({
    field: s.field,
    path: runFlags[s.field] ?? `${argsSequence}${s.suffix}`,
  }))
  const name = runFlags.name || spec.defaultName(argsSequence)
  const adapter = {
    type: spec.adapterType,
    [spec.locField]: uri(argsSequence),
    ...Object.fromEntries(sidecars.map(s => [s.field, uri(s.path)])),
  }
  return {
    assembly: { name, sequence: makeSequence(name, adapter) },
    filesToLoad: [argsSequence, ...sidecars.map(s => s.path)],
  }
}

function makeSequence(name: string, adapter: Sequence['adapter']): Sequence {
  return {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}-ReferenceSequenceTrack`,
    adapter,
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// --config is merged shallowly, except for `sequence`: the generated
// ReferenceSequenceTrack already holds the adapter built from the sequence
// file, so a `sequence` hunk layers onto it (e.g. formatAbout) rather than
// replacing it and dropping the adapter
function applyExtraConfig(assembly: Assembly, config?: string): Assembly {
  if (config === undefined) {
    return assembly
  }
  const { sequence, name, ...rest } = parseConfigFlag(config)
  if (sequence !== undefined && !isRecord(sequence)) {
    throw new Error('--config "sequence" must be an object')
  }
  if (name !== undefined) {
    throw new Error('use --name rather than "name" in --config')
  }
  return {
    ...assembly,
    ...rest,
    name: assembly.name,
    sequence: { ...assembly.sequence, ...sequence },
  }
}

export async function enhanceAssembly(
  assembly: Assembly,
  runFlags: AssemblyFlags,
): Promise<{ assembly: Assembly; filesToLoad: string[] }> {
  const { refNameAliases, refNameAliasesType } = runFlags

  // a non-custom refNameAliases points at a local aliases file whose location
  // is rewritten to a bare basename by mapLocationForFiles, so the file itself
  // must be loaded into the config dir alongside the sequence. Custom aliases
  // are embedded inline (no file), and URLs are referenced in place.
  const filesToLoad =
    refNameAliases && refNameAliasesType !== 'custom' && !isURL(refNameAliases)
      ? [refNameAliases]
      : []

  // typed flags layer over --config, so the most specific flag a user reaches
  // for wins
  return {
    assembly: {
      ...applyExtraConfig(assembly, runFlags.config),
      ...(runFlags.alias?.length && { aliases: runFlags.alias }),
      ...(runFlags.refNameColors && {
        refNameColors: parseCommaSeparatedString(runFlags.refNameColors),
      }),
      ...(runFlags.displayName && { displayName: runFlags.displayName }),
      ...(refNameAliases && {
        refNameAliases: { adapter: await resolveRefNameAliasAdapter(runFlags) },
      }),
    },
    filesToLoad,
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
