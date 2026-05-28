import { transaction } from 'mobx'

import { diagonalizeRegions } from './diagonalize.ts'

import type { AlignmentData } from './diagonalize.ts'
import type { SyntenyFeatureData } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../model.ts'

type Level = LinearSyntenyViewModel['levels'][number]

export function collectAlignments(level: Level): AlignmentData[] {
  const out: AlignmentData[] = []
  for (const track of level.tracks) {
    for (const display of track.displays) {
      const fd = (display as { featureData?: SyntenyFeatureData }).featureData
      if (!fd) {
        continue
      }
      for (let i = 0; i < fd.refNames.length; i++) {
        out.push({
          refRefName: fd.refNames[i]!,
          queryRefName: fd.mateRefNames[i]!,
          refStart: fd.starts[i]!,
          refEnd: fd.ends[i]!,
          queryStart: fd.mateStarts[i]!,
          queryEnd: fd.mateEnds[i]!,
          strand: fd.strands[i]!,
        })
      }
    }
  }
  return out
}

export interface RunDiagonalizeResult {
  totalReordered: number
  totalReversed: number
}

// Whether every synteny display across every level has either populated
// its featureData or surfaced an error. Used by the init autoDiagonalize
// gate to wait for the first RPC round-trip without deadlocking on stuck
// or minimized displays (the caller pairs this with a wall-clock timeout).
// for-of (not .every) because mobx-state-tree's observable arrays widen
// the .every callback parameter to `any`.
export function displaysReady(model: LinearSyntenyViewModel): boolean {
  for (const level of model.levels) {
    for (const track of level.tracks) {
      for (const display of track.displays) {
        const d = display as { featureData?: unknown; error?: unknown }
        if (!d.featureData && !d.error) {
          return false
        }
      }
    }
  }
  return true
}

// Collects loaded feature data from every level's synteny displays, runs the
// diagonalization algorithm per level, and applies the resulting region
// reorderings/reversals atomically. Shared by the menu dialog (UI wrapper) and
// the init autorun (autoDiagonalize flag).
export async function runDiagonalize(
  model: LinearSyntenyViewModel,
): Promise<RunDiagonalizeResult | undefined> {
  if (model.views.length < 2) {
    return undefined
  }
  const perLevel: {
    queryView: LinearSyntenyViewModel['views'][number]
    result: Awaited<ReturnType<typeof diagonalizeRegions>>
  }[] = []
  for (const [i, level] of model.levels.entries()) {
    const alignments = collectAlignments(level)
    if (alignments.length > 0) {
      const queryView = model.views[i + 1]!
      const result = await diagonalizeRegions(
        alignments,
        model.views[i]!.displayedRegions,
        queryView.displayedRegions,
      )
      perLevel.push({ queryView, result })
    }
  }
  let totalReversed = 0
  let totalReordered = 0
  transaction(() => {
    for (const { queryView, result } of perLevel) {
      queryView.setDisplayedRegions(result.newRegions)
      totalReversed += result.stats.regionsReversed
      totalReordered += result.stats.regionsReordered
    }
  })
  return { totalReordered, totalReversed }
}
