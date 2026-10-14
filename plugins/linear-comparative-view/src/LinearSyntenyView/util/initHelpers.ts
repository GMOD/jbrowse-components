import { coversAssemblies } from '@jbrowse/synteny-core'

import type { SyntenyTrackInit } from '../types.ts'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'

export interface TrackPlacementProblem {
  level: 'error' | 'warning'
  message: string
}

function entryId(entry: SyntenyTrackInit) {
  return typeof entry === 'string' ? entry : entry.trackId
}

/**
 * Which band each spec `tracks` entry goes on. A nested list names the band
 * itself. A flat list puts each track on every band whose pair of rows its
 * `assemblyNames` cover, so one multi-genome track backs a whole stack and a
 * pairwise chain finds its own bands.
 *
 * `assemblyNamesOf` answers `undefined` for a trackId the session does not
 * know; such an entry goes on band 0, where the launch reports it.
 */
export function placeSyntenyTracks({
  tracks,
  rows,
  assemblyNamesOf,
  assemblyManager,
}: {
  tracks: SyntenyTrackInit[] | SyntenyTrackInit[][]
  rows: string[]
  assemblyNamesOf: (entry: SyntenyTrackInit) => string[] | undefined
  assemblyManager: AssemblyNameResolver
}) {
  const entries: (SyntenyTrackInit | SyntenyTrackInit[])[] = tracks
  const nested = entries.filter((entry): entry is SyntenyTrackInit[] =>
    Array.isArray(entry),
  )
  const flat = entries.filter(
    (entry): entry is SyntenyTrackInit => !Array.isArray(entry),
  )
  if (flat.length === 0) {
    return { levels: nested, problems: [] }
  }
  const bands = rows.slice(1).map((row, i) => [rows[i]!, row])
  const levels = bands.map((): SyntenyTrackInit[] => [])
  const problems: TrackPlacementProblem[] = []
  if (nested.length > 0) {
    problems.push({
      level: 'error',
      message:
        'LinearSyntenyView `tracks` mixes per-band lists with track entries: write a list per band, or one flat list',
    })
    return { levels, problems }
  }
  for (const entry of flat) {
    const names = assemblyNamesOf(entry)
    const covered = names
      ? bands.flatMap((pair, i) =>
          coversAssemblies(names, pair, assemblyManager) ? [i] : [],
        )
      : [0]
    if (names?.length === 0) {
      problems.push({
        level: 'error',
        message: `Synteny track "${entryId(entry)}" names no assemblyNames, so no band can be chosen for it`,
      })
    } else if (covered.length === 0) {
      problems.push({
        level: 'error',
        message: `Synteny track "${entryId(entry)}" (${names!.join(', ')}) covers no adjacent pair of rows`,
      })
    }
    for (const i of covered) {
      levels[i]?.push(entry)
    }
  }
  if (problems.length === 0) {
    for (const [i, pair] of bands.entries()) {
      if (levels[i]!.length === 0) {
        problems.push({
          level: 'warning',
          message: `No synteny track in \`tracks\` covers the band between ${pair.join(' and ')}`,
        })
      }
    }
  }
  return { levels, problems }
}
