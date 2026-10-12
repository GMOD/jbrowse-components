import {
  getConfAssemblyNames,
  isSameAssemblyName,
} from '@jbrowse/core/util/tracks'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// `SortedBy` in plugins/alignments/src/shared/types.ts, restated: this plugin
// takes no dependency on the alignments plugin and drives its display by duck
// type
export interface SortedByLike {
  type: string
  pos: number
  refName: string
  tag?: string
}

/**
 * The slice of `LinearAlignmentsDisplay` review drives. Every member is an
 * action or getter that display already exposes; `setSortedByAtPosition`, not
 * `setSortedBy(type)`, which reads the view's centre line and turns it on.
 */
export interface SortableAlignmentsDisplay extends IStateTreeNode {
  id: string
  type: string
  sortedBy?: SortedByLike
  layoutOrder: string
  setSortedByAtPosition(s: SortedByLike): void
  setLayoutOrder(o: string): void
}

export interface ReviewHostTrack extends IStateTreeNode {
  type: string
  configuration: AnyConfigurationModel
  displays: unknown[]
}

export const ALIGNMENTS_DISPLAY_TYPE = 'LinearAlignmentsDisplay'

// `LGVSyntenyDisplay` shares the alignments pipeline and the type check keeps
// it out; the function check keeps out anything else wearing the name
export function isSortableAlignmentsDisplay(
  d: unknown,
): d is SortableAlignmentsDisplay {
  const candidate = d as Partial<SortableAlignmentsDisplay> | null
  return (
    !!candidate &&
    candidate.type === ALIGNMENTS_DISPLAY_TYPE &&
    typeof candidate.setSortedByAtPosition === 'function' &&
    typeof candidate.setLayoutOrder === 'function'
  )
}

export function trackOnAssembly(
  track: ReviewHostTrack,
  assemblyName: string | undefined,
  assemblyManager: AssemblyNameResolver,
) {
  try {
    return getConfAssemblyNames(track.configuration).some(name =>
      isSameAssemblyName(name, assemblyName, assemblyManager),
    )
  } catch {
    return false
  }
}

/**
 * Every alignments display in the view on the view's assembly, narrowed to
 * `targetTrackIds` when that names any. A getter over the live track list, so
 * a track opened mid-review is a target at the next keystroke.
 */
export function findReviewTargets({
  tracks,
  assemblyName,
  assemblyManager,
  targetTrackIds,
}: {
  tracks: readonly ReviewHostTrack[]
  assemblyName: string | undefined
  assemblyManager: AssemblyNameResolver
  targetTrackIds: readonly string[]
}) {
  const only = targetTrackIds.length > 0 ? new Set(targetTrackIds) : undefined
  return tracks
    .filter(
      t =>
        (!only || only.has(t.configuration.trackId as string)) &&
        trackOnAssembly(t, assemblyName, assemblyManager),
    )
    .flatMap(t => t.displays.filter(isSortableAlignmentsDisplay))
}
