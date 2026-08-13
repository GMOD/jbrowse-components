import { readConfObject } from '@jbrowse/core/configuration'
import { canonicalAssemblyNames } from '@jbrowse/core/util/tracks'

import type { BreakpointSplitViewInitView } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'

export interface ImportFormRowData {
  assembly: string
  loc: string
}

// Connecting curves require the SAME trackId open in every row, so a track is
// only offerable if its assemblyNames cover all the selected assemblies. Tracks
// with no assemblyNames are excluded rather than throwing.
//
// Both sides go through the assembly manager's aliases, as the track selector's
// own filter does: the rows name assemblies canonically (they come from a
// dropdown of the session's) while a track config is free to name an alias, and
// comparing the two raw hides a track here that the track selector offers.
export function getSharedTracks(
  tracks: AnyConfigurationModel[],
  assemblies: string[],
  assemblyManager: AssemblyNameResolver,
) {
  const needed = canonicalAssemblyNames(assemblies, assemblyManager)
  return tracks.filter(track => {
    const names = readConfObject(track, 'assemblyNames') as string[] | undefined
    if (!names) {
      return false
    }
    const available = new Set(canonicalAssemblyNames(names, assemblyManager))
    return needed.every(asm => available.has(asm))
  })
}

export function swap<T>(arr: T[], i: number, j: number) {
  const next = [...arr]
  next[i] = arr[j]!
  next[j] = arr[i]!
  return next
}

// Map import-form rows + the optional shared track into the view initializers
// consumed by model.setViews. A blank loc means "whole assembly"; a blank
// trackId means "open no track".
export function rowsToViewInits(
  rows: ImportFormRowData[],
  trackId: string,
): BreakpointSplitViewInitView[] {
  return rows.map(r => ({
    assembly: r.assembly,
    loc: r.loc || undefined,
    tracks: trackId ? [trackId] : undefined,
  }))
}
