import path from 'node:path'

import { genomeAssembly, splitModifier } from '@jbrowse/launch-args'

import { makeSyntenyTrackConfig, syntenyTrackTypes } from './makeConfigs.ts'

import type { Assembly, Track } from './types.ts'
import type { Entry } from '@jbrowse/launch-args'

export interface ComparativeData {
  assemblies: Assembly[]
  // Per-assembly location string, aligned with `assemblies`; undefined renders
  // that assembly whole-genome.
  locs: (string | undefined)[]
  syntenyTracks: Track[]
}

interface RawSynteny {
  type: string
  file: string
  // number of assemblies defined before this synteny flag in argv order
  before: number
}

function isAssemblyFlag(key: string) {
  return key === 'fasta' || key === 'chromSizes'
}

// Whether the CLI args describe a comparative (multi-assembly) view: a second
// assembly (a repeated --fasta, or any --chromSizes) or a synteny file. A lone
// --fasta is a plain linear view, built elsewhere.
export function hasComparativeArgs(entries: Entry[]) {
  let fastas = 0
  for (const [key] of entries) {
    if (key === 'fasta') {
      fastas += 1
    } else if (key === 'chromSizes' || syntenyTrackTypes.includes(key)) {
      return true
    }
  }
  return fastas > 1
}

// Build the assemblies + per-level synteny tracks of a comparative (dotplot /
// synteny) view from CLI args, honoring argv order. Each `--fasta`/`--chromSizes`
// opens a new assembly stacked top-to-bottom, with its `loc:`, `aliases:` and
// `cytobands:` modifiers; a synteny file binds to the gap between the assembly
// written before it and the next one, so level placement falls out of the
// order. A trailing synteny flag (the comparison after both assemblies) clamps
// to the last gap.
export function buildComparative(entries: Entry[]): ComparativeData {
  const assemblies: Assembly[] = []
  const locs: (string | undefined)[] = []
  const rawSynteny: RawSynteny[] = []
  for (const [key, vals] of entries) {
    const file = vals[0]
    if (isAssemblyFlag(key)) {
      const trackId =
        assemblies.length === 0
          ? 'refseq'
          : `${path.basename(file ?? '')}-refseq`
      const { assembly, unused } = genomeAssembly(key, vals, trackId)
      const loc = unused.find(mod => splitModifier(mod)?.[0] === 'loc')
      const extra = unused.filter(mod => mod !== loc)
      if (extra.length) {
        throw new Error(
          `--${key} ${file} takes loc:, aliases: and cytobands:, not ${extra.join(' ')}`,
        )
      }
      assemblies.push(assembly)
      locs.push(loc && splitModifier(loc)?.[1])
    } else if (syntenyTrackTypes.includes(key)) {
      if (!file) {
        throw new Error(`--${key} requires a file argument`)
      }
      rawSynteny.push({ type: key, file, before: assemblies.length })
    }
  }

  const numLevels = assemblies.length - 1
  const syntenyTracks = rawSynteny.map(({ type, file, before }) => {
    if (numLevels < 1) {
      throw new Error(
        `comparison track "${type}" requires a second assembly (add another --fasta or --chromSizes)`,
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
