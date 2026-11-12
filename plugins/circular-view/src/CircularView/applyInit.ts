import { getSession, resolveNamedRegions } from '@jbrowse/core/util'
import {
  isSameAssemblyName,
  normalizeTrackInit,
} from '@jbrowse/core/util/tracks'

import type { CircularViewCommands } from './types.ts'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
import type { Region } from '@jbrowse/core/util/types'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// duck-typed so `applyInit` can live outside the factory
export interface CircularViewInitSelf extends IStateTreeNode {
  setDisplayedRegions: (regions: Region[]) => void
  launchTrack: (
    trackId: string,
    trackSnapshot?: Record<string, unknown>,
    displaySnapshot?: Record<string, unknown>,
  ) => Promise<unknown>
  beginAutoDiagonalize: (requested: boolean) => void
  finishAutoDiagonalize: () => void
  autoDiagonalize: () => Promise<void>
  canDiagonalize: boolean
  colorField: string | undefined
  colorValue: string | undefined
  setColorField: (field: string | undefined) => void
}

/** The assemblies a launch blob draws, in the order it names them. */
export function launchAssemblyNames(init: LaunchInput<CircularViewCommands>) {
  const { assembly } = init
  return assembly === undefined ? [] : [assembly].flat()
}

function namesForAssembly(
  names: CircularViewCommands['displayedRegionNames'],
  assemblyName: string,
  assemblyManager: AssemblyNameResolver,
) {
  return Array.isArray(names) || names === undefined
    ? names
    : Object.entries(names).find(([name]) =>
        isSameAssemblyName(name, assemblyName, assemblyManager),
      )?.[1]
}

/**
 * Apply one launch blob: the regions the circle is drawn from, each assembly's
 * slices in the order it was named, then the tracks, then the reorder. A blob
 * that draws nothing throws, which `installInitAutorun` lands on the import
 * form's error banner.
 */
export async function applyInit(
  self: CircularViewInitSelf,
  init: LaunchInput<CircularViewCommands>,
) {
  const session = getSession(self)
  const drawn: Region[] = []
  const { assemblyManager } = session
  for (const assemblyName of launchAssemblyNames(init)) {
    const assembly = assemblyManager.get(assemblyName)
    const regions = assembly?.regions
    if (!assembly || !regions) {
      continue
    }
    const names = namesForAssembly(
      init.displayedRegionNames,
      assemblyName,
      assemblyManager,
    )
    // a list matching nothing in this assembly draws it whole, and warns;
    // `?.length` because `[]` is truthy
    const whole = assembly.wholeGenomeRegions
    const named = names?.length
      ? resolveNamedRegions({
          regions,
          names,
          assemblyName,
          getCanonicalRefName: assembly.getCanonicalRefName2,
          allRefNames: assembly.allRefNames,
          genome: whole,
          notify: message => {
            session.notify(message, 'warning')
          },
        })
      : whole
    drawn.push(...(named ?? whole))
  }
  if (!drawn.length) {
    throw new Error(
      `${launchAssemblyNames(init).join(' and ')} has no regions to display`,
    )
  }
  const twoGenomes = new Set(drawn.map(r => r.assemblyName)).size === 2
  const reorder = init.autoDiagonalize ?? twoGenomes
  // raised before any ribbon can paint; only the reorder lowers it
  self.beginAutoDiagonalize(reorder)
  self.setDisplayedRegions(drawn)
  for (const t of init.tracks ?? []) {
    const { trackId, trackSnapshot, displaySnapshot, modifiers } =
      normalizeTrackInit(t)
    if (modifiers.length) {
      session.notify(
        `"${trackId}" ${modifiers.join(' ')}: track options apply in a linear genome view, not a circular one`,
        'warning',
      )
    }
    await self.launchTrack(trackId, trackSnapshot, displaySnapshot)
  }
  // a default reorder with no ribbons to order by lowers the gate instead
  if (reorder && (init.autoDiagonalize || self.canDiagonalize)) {
    await self.autoDiagonalize()
  } else if (reorder) {
    self.finishAutoDiagonalize()
  }
}
