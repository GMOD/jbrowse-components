import path from 'node:path'

import { syntenyAdapterTypes } from './fileAdapter.ts'
import { fileAdapter, genomeAssembly, isSequenceAdapter } from './fileInput.ts'
import {
  FILE_FLAG,
  isDataFile,
  modifierValue,
  splitModifier,
} from './parseArgv.ts'

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

function isSyntenyFlag(key: string): key is SyntenyFlag {
  return key in syntenyFlagAdapters
}

function isGenomeFlag(key: string) {
  return key === 'fasta' || key === 'chromSizes'
}

/**
 * What an entry is to a comparative view: a genome (`--fasta`, `--chromSizes`
 * or a bare genome file), a comparison (a comparison flag or a bare file the
 * format table reads as a SyntenyTrack), or neither.
 */
export function comparativeRole([key, [file]]: Entry) {
  if (isGenomeFlag(key)) {
    return 'genome'
  } else if (isSyntenyFlag(key)) {
    return 'synteny'
  } else if (key === FILE_FLAG && file && isDataFile(file)) {
    const adapter = fileAdapter(file)
    return isSequenceAdapter(adapter)
      ? 'genome'
      : syntenyAdapterTypes.has(adapter.type)
        ? 'synteny'
        : undefined
  } else {
    return undefined
  }
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
  name = path.basename(file),
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
    trackId: path.basename(file),
    name,
    // [query, target], as comparative-adapters reads it
    assemblyNames: [queryAssembly, targetAssembly],
    adapter: { ...adapter, queryAssembly, targetAssembly },
  }
}

export interface ComparativeData {
  /** in stacking order: the first is the top row and a dotplot's x axis */
  assemblies: Assembly[]
  /** each assembly's `loc:`, aligned with `assemblies`; undefined shows it whole */
  locs: (string | undefined)[]
  syntenyTracks: Track[]
}

const GENOME_TAKES = new Set(['loc', 'aliases', 'cytobands'])

/**
 * The genomes and comparisons of a comparative view, in command-line order.
 *
 * - Each genome opens a row, with its `loc:`, `aliases:` and `cytobands:`.
 * - A comparison file binds to the gap between the genome before it and the
 *   next one; a trailing one, written after both, clamps to the last gap.
 * - A comparison takes `name:`; any other modifier, on it or on a genome,
 *   throws.
 */
export function buildComparative(entries: Entry[]): ComparativeData {
  const assemblies: Assembly[] = []
  const locs: (string | undefined)[] = []
  const comparisons: { entry: Entry; before: number }[] = []
  for (const entry of entries) {
    const [key, vals] = entry
    const [file, ...mods] = vals
    const role = comparativeRole(entry)
    const label = key === FILE_FLAG ? file : `--${key} ${file}`
    if (role === 'genome') {
      const trackId =
        assemblies.length === 0
          ? 'refseq'
          : `${path.basename(file ?? '')}-refseq`
      const { assembly } = genomeAssembly(key, vals, trackId)
      const extra = mods.filter(
        mod => !GENOME_TAKES.has(splitModifier(mod)?.[0] ?? ''),
      )
      if (extra.length) {
        throw new Error(
          `${label} takes loc:, aliases: and cytobands:, not ${extra.join(' ')}`,
        )
      }
      assemblies.push(assembly)
      locs.push(modifierValue(mods, 'loc'))
    } else if (role === 'synteny') {
      if (!file) {
        throw new Error(`--${key} requires a file argument`)
      }
      const extra = mods.filter(mod => splitModifier(mod)?.[0] !== 'name')
      if (extra.length) {
        throw new Error(`${label} takes name:, not ${extra.join(' ')}`)
      }
      comparisons.push({ entry, before: assemblies.length })
    }
  }

  const numLevels = assemblies.length - 1
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
      assemblies[level]!.name,
      assemblies[level + 1]!.name,
      modifierValue(mods, 'name'),
    )
  })

  return { assemblies, locs, syntenyTracks }
}

/**
 * A comparative view's rows, as a session spec's `views` lists them: one per
 * genome, at its `loc:` or whole.
 */
export function stackedViews({
  assemblies,
  locs,
}: Pick<ComparativeData, 'assemblies' | 'locs'>) {
  return assemblies.map((asm, i) => {
    const loc = locs[i]
    return loc ? { assembly: asm.name, loc } : { assembly: asm.name }
  })
}
