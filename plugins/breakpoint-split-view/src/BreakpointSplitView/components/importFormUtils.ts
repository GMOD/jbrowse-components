import { readConfObject } from '@jbrowse/core/configuration'

import type { BreakpointSplitViewInitView } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface ImportFormRowData {
  assembly: string
  loc: string
}

// Connecting curves require the SAME trackId open in every row, so a track is
// only offerable if its assemblyNames cover all the selected assemblies. Tracks
// with no assemblyNames are excluded rather than throwing.
export function getSharedTracks(
  tracks: AnyConfigurationModel[],
  assemblies: string[],
) {
  return tracks.filter(track => {
    const names = readConfObject(track, 'assemblyNames') as string[] | undefined
    return assemblies.every(asm => names?.includes(asm))
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
