import path from 'node:path'

import { fileNameOf } from '@jbrowse/add-track-core'

import { adapterTypeByName, syntenyAdapterTypes } from './fileAdapter.ts'
import {
  fileAdapter,
  genomeAssembly,
  isGenomeFlag,
  isSequenceAdapter,
} from './fileInput.ts'
import { FILE_FLAG, isUrl, modifierValue, splitModifier } from './parseArgv.ts'

import type { Adapter } from './fileAdapter.ts'
import type { Assembly, Track } from './fileInput.ts'
import type { Entry } from './parseArgv.ts'

/** The comparison flags, each naming the adapter that reads its file. */
export const syntenyFlagAdapters = {
  paf: 'PAFAdapter',
  blasttab: 'BlastTabularAdapter',
  chain: 'ChainAdapter',
  delta: 'DeltaAdapter',
} as const

export type SyntenyFlag = keyof typeof syntenyFlagAdapters

export const syntenyFlags = Object.keys(syntenyFlagAdapters) as SyntenyFlag[]

/**
 * Whether a comparison file's query is the upper of the two genomes it sits
 * between, the one written first, keyed by the adapter that reads it.
 *
 * - PAF, PIF, MashMap and BLAST list the query first, as minimap2 and blast
 *   align a query against a target, so the upper genome is the query.
 * - A chain or delta file maps target to query (a UCSC
 *   `targetToQuery.over.chain` maps FROM the target), so the upper genome is
 *   the target. Getting it backwards mis-maps every coordinate and most
 *   alignments drop out.
 */
const upperIsQuery: Record<string, boolean> = {
  PAFAdapter: true,
  PairwiseIndexedPAFAdapter: true,
  MashMapAdapter: true,
  BlastTabularAdapter: true,
  ChainAdapter: false,
  DeltaAdapter: false,
}

export function isSyntenyFlag(key: string): key is SyntenyFlag {
  return Object.hasOwn(syntenyFlagAdapters, key)
}

/**
 * What an entry is to a comparative view: a genome (`--fasta`, `--chromSizes`
 * or a bare genome file), a comparison (a comparison flag or a bare file the
 * format table reads as a SyntenyTrack), or neither. A bare file's role comes
 * from its name alone.
 */
export function comparativeRole([key, [file]]: Entry) {
  if (isGenomeFlag(key)) {
    return 'genome'
  } else if (isSyntenyFlag(key)) {
    return 'synteny'
  }
  const type = key === FILE_FLAG && file ? adapterTypeByName(file) : undefined
  return !type
    ? undefined
    : isSequenceAdapter({ type })
      ? 'genome'
      : syntenyAdapterTypes.has(type)
        ? 'synteny'
        : undefined
}

/**
 * Whether a command line describes a comparative view: a second genome, or a
 * comparison file. A lone genome is a linear view.
 */
export function hasComparativeArgs(entries: Entry[]) {
  const roles = entries.map(comparativeRole)
  return (
    roles.includes('synteny') || roles.filter(r => r === 'genome').length > 1
  )
}

/**
 * The SyntenyTrack for a comparison file between two stacked genomes, upper
 * first. The adapter's file format decides which is the query.
 */
export function syntenyTrack(
  adapter: Adapter,
  file: string,
  upperAssembly: string,
  lowerAssembly: string,
  name = fileNameOf(file),
): Track {
  const queryFirst = upperIsQuery[adapter.type]
  if (queryFirst === undefined) {
    throw new Error(
      `${file} is a ${adapter.type} file, which the command line cannot place between two genomes; add it as a track in the app`,
    )
  }
  const queryAssembly = queryFirst ? upperAssembly : lowerAssembly
  const targetAssembly = queryFirst ? lowerAssembly : upperAssembly
  return {
    type: 'SyntenyTrack',
    trackId: fileNameOf(file),
    name,
    // [query, target], as comparative-adapters reads it
    assemblyNames: [queryAssembly, targetAssembly],
    adapter: { ...adapter, queryAssembly, targetAssembly },
  }
}

/** One row of a comparative view, as a session spec's `views` lists it. */
export interface ComparativeRow {
  assembly: string
  loc?: string
}

export interface ComparativeData {
  /** each genome once, in the order the command line first names it */
  assemblies: Assembly[]
  /** in stacking order: the first is the top row and a dotplot's x axis */
  rows: ComparativeRow[]
  syntenyTracks: Track[]
}

const ASSEMBLY_MODIFIERS = ['aliases', 'cytobands']

// local paths compare resolved, so `./a.fa` and `a.fa` are one file
function sameFile(a: string, b: string) {
  return (
    a === b || (!isUrl(a) && !isUrl(b) && path.resolve(a) === path.resolve(b))
  )
}

// whether a repeat row sets `key:` to a value its first row did not
function changes(firstMods: string[], mods: string[], key: string) {
  const value = modifierValue(mods, key)
  const was = modifierValue(firstMods, key)
  return value !== undefined && (was === undefined || !sameFile(was, value))
}

/**
 * The genomes and comparisons of a comparative view, in command-line order.
 *
 * - Each genome opens a row, at its `loc:` or whole, with its `aliases:` and
 *   `cytobands:`, named after its file, and two files of one name throw.
 * - One file named twice is a self-comparison, two rows of one assembly that
 *   take its `aliases:` and `cytobands:` from the first row.
 * - A comparison file binds to the gap between the genome before it and the
 *   next one; a trailing one, written after both, clamps to the last gap.
 * - A comparison takes `name:`; any other modifier, on it or on a genome,
 *   throws.
 */
export function buildComparative(entries: Entry[]): ComparativeData {
  const assemblies: Assembly[] = []
  const genomes = new Map<string, { file: string; mods: string[] }>()
  const rows: ComparativeRow[] = []
  const comparisons: { entry: Entry; before: number }[] = []
  for (const entry of entries) {
    const [key, vals] = entry
    const [file = '', ...mods] = vals
    const role = comparativeRole(entry)
    const label = key === FILE_FLAG ? file : `--${key} ${file}`
    if (role === 'genome') {
      const { assembly, unused } = genomeAssembly(
        key,
        vals,
        assemblies.length === 0 ? 'refseq' : `${fileNameOf(file)}-refseq`,
      )
      const extra = unused.filter(mod => splitModifier(mod)?.[0] !== 'loc')
      if (extra.length) {
        throw new Error(
          `${label} takes loc:, aliases: and cytobands:, not ${extra.join(' ')}`,
        )
      }
      const first = genomes.get(assembly.name)
      if (!first) {
        genomes.set(assembly.name, { file, mods })
        assemblies.push(assembly)
      } else if (!sameFile(first.file, file)) {
        throw new Error(
          `${first.file} and ${file} are both named ${assembly.name}, and a genome takes its file's name; rename or link one of them`,
        )
      } else if (
        ASSEMBLY_MODIFIERS.some(key => changes(first.mods, mods, key))
      ) {
        throw new Error(
          `${label} repeats ${assembly.name}, which takes its aliases: and cytobands: on its first row; a repeat row takes loc:, or restates them unchanged`,
        )
      }
      const loc = modifierValue(mods, 'loc')
      rows.push(
        loc ? { assembly: assembly.name, loc } : { assembly: assembly.name },
      )
    } else if (role === 'synteny') {
      if (!file) {
        throw new Error(`--${key} requires a file argument`)
      }
      const extra = mods.filter(mod => splitModifier(mod)?.[0] !== 'name')
      if (extra.length) {
        throw new Error(`${label} takes name:, not ${extra.join(' ')}`)
      }
      comparisons.push({ entry, before: rows.length })
    }
  }

  const numLevels = rows.length - 1
  const syntenyTracks = comparisons.map(({ entry, before }) => {
    const [key, [file = '', ...mods]] = entry
    if (numLevels < 1) {
      throw new Error(
        `${file} compares two genomes, and this command line names one; add another FASTA, 2bit or .chrom.sizes`,
      )
    }
    const level = Math.min(Math.max(before - 1, 0), numLevels - 1)
    const adapter = fileAdapter(file, {
      adapterType: isSyntenyFlag(key) ? syntenyFlagAdapters[key] : undefined,
    })
    return syntenyTrack(
      adapter,
      file,
      rows[level]!.assembly,
      rows[level + 1]!.assembly,
      modifierValue(mods, 'name'),
    )
  })

  return { assemblies, rows, syntenyTracks }
}
