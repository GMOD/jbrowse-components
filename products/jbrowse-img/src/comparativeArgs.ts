import path from 'path'

import {
  makeChromSizesAssembly,
  makeFastaAssembly,
  makeSyntenyTrackConfig,
  syntenyTrackTypes,
} from './makeConfigs.ts'

import type { Entry } from './parseArgv.ts'
import type { Assembly, Track } from './types.ts'

// Per-assembly options can ride on the assembly flag as `key:value` modifiers,
// e.g. `--chromSizes hg38.chrom.sizes loc:chr1 aliases:a.txt` — the same
// modifier convention the track flags use.
function parseModifiers(vals: string[]) {
  const mods: Record<string, string> = {}
  for (const v of vals.slice(1)) {
    const i = v.indexOf(':')
    if (i > 0) {
      mods[v.slice(0, i)] = v.slice(i + 1)
    }
  }
  return mods
}

export interface ComparativeData {
  assemblies: Assembly[]
  // Per-assembly location string, aligned with `assemblies`; undefined renders
  // that assembly whole-genome.
  locs: (string | undefined)[]
  syntenyTracks: Track[]
}

interface RawAssembly {
  kind: 'fasta' | 'chromSizes'
  file: string
  mods: Record<string, string>
}

interface RawSynteny {
  type: string
  file: string
  // number of assemblies defined before this synteny flag in argv order
  before: number
}

// Whether the CLI args describe a comparative (multi-assembly) view: a second
// assembly (a repeated --fasta, --fasta2, or any --chromSizes) or a synteny
// file. A lone --fasta is a plain linear view, built elsewhere.
export function hasComparativeArgs(entries: Entry[]) {
  let fastas = 0
  for (const [key] of entries) {
    if (key === 'fasta' || key === 'fasta2') {
      fastas += 1
    } else if (key === 'chromSizes' || syntenyTrackTypes.includes(key)) {
      return true
    }
  }
  return fastas > 1
}

// Legacy single-assembly comparative flags map to a per-index default
// ([assembly0, assembly1]) that a `key:value` modifier on the flag overrides.
const legacyDefaults: Record<string, [index: number, field: string]> = {
  loc: [0, 'loc'],
  aliases: [0, 'aliases'],
  cytobands: [0, 'cytobands'],
  loc2: [1, 'loc'],
  aliases2: [1, 'aliases'],
}

// Build the assemblies + per-level synteny tracks of a comparative (dotplot /
// synteny) view from CLI args, honoring argv order. Each `--fasta`/`--chromSizes`
// opens a new assembly stacked top-to-bottom; a synteny file binds to the gap
// between the assembly written before it and the next one, so level placement
// falls out of the order. A trailing synteny flag (the legacy 2-way style, where
// the comparison comes after both assemblies) clamps to the last gap.
export function buildComparative(entries: Entry[]): ComparativeData {
  const rawAssemblies: RawAssembly[] = []
  const rawSynteny: RawSynteny[] = []
  const legacy: Record<string, string>[] = [{}, {}]
  for (const [key, vals] of entries) {
    const file = vals[0]
    if (key === 'fasta' || key === 'fasta2') {
      if (!file) {
        throw new Error(`--${key} requires a file argument`)
      }
      rawAssemblies.push({ kind: 'fasta', file, mods: parseModifiers(vals) })
    } else if (key === 'chromSizes') {
      if (!file) {
        throw new Error('--chromSizes requires a file argument')
      }
      rawAssemblies.push({
        kind: 'chromSizes',
        file,
        mods: parseModifiers(vals),
      })
    } else if (syntenyTrackTypes.includes(key)) {
      if (!file) {
        throw new Error(`--${key} requires a file argument`)
      }
      rawSynteny.push({ type: key, file, before: rawAssemblies.length })
    } else if (key in legacyDefaults && file !== undefined) {
      const [index, field] = legacyDefaults[key]!
      legacy[index]![field] = file
    }
  }

  const assemblies: Assembly[] = []
  const locs: (string | undefined)[] = []
  rawAssemblies.forEach((raw, i) => {
    const defaults = legacy[i] ?? {}
    const aliases = raw.mods.aliases ?? defaults.aliases
    const cytobands = raw.mods.cytobands ?? defaults.cytobands
    const trackId = i === 0 ? 'refseq' : `${path.basename(raw.file)}-refseq`
    assemblies.push(
      raw.kind === 'chromSizes'
        ? makeChromSizesAssembly(raw.file, aliases, cytobands, trackId)
        : makeFastaAssembly(raw.file, aliases, cytobands, trackId),
    )
    locs.push(raw.mods.loc ?? defaults.loc)
  })

  const numLevels = assemblies.length - 1
  const syntenyTracks = rawSynteny.map(({ type, file, before }) => {
    if (numLevels < 1) {
      throw new Error(
        `comparison track "${type}" requires a second assembly (add another --fasta/--chromSizes, or --fasta2)`,
      )
    }
    // the gap above the upcoming assembly; trailing tracks clamp to the last
    const level = Math.min(Math.max(before - 1, 0), numLevels - 1)
    const upperAssembly = assemblies[level]!.name
    const lowerAssembly = assemblies[level + 1]!.name
    return makeSyntenyTrackConfig(type, file, upperAssembly, lowerAssembly)
  })

  return { assemblies, locs, syntenyTracks }
}
