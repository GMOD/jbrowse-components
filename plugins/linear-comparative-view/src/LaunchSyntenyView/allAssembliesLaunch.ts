import { readConfObject } from '@jbrowse/core/configuration'

import { containingPanelStack } from '../LGVSyntenyDisplay/matePanelNavigation.ts'
import { anchorPanelTracks } from './anchorPanelTracks.ts'
import { syntenyRegionMenuItems } from './regionLaunchMenuItems.ts'

import type { SyntenyLaunchHost } from './regionLaunchMenuItems.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export const ALL_ASSEMBLIES_LABEL = 'Linear synteny view, all assemblies here'

/**
 * The multi-panel launch from one synteny track: a row for every assembly
 * `region` aligns to in this dataset, not just the mate of the alignment under
 * the cursor.
 *
 * Only on a track declaring three or more assemblies. On a pairwise track the
 * region launch discovers the one mate the pairwise item already offers, so
 * this would be that with a fetch in front of it. A one-vs-all track whose
 * extra mates are undeclared PanSN samples is the same case: those cannot open
 * a panel whichever route is taken.
 *
 * The track is the only dataset offered — the region launch from the view menu
 * lists every open synteny track, but a click on this track means this track.
 * The launched view offers to replace the stack the panel came from, not the
 * panel: a row of a stack holds no session slot of its own.
 */
export function allAssembliesLaunchItems({
  session,
  view,
  track,
  region,
}: {
  session: SyntenyLaunchHost
  view: LinearGenomeViewModel
  track: AnyConfigurationModel
  region: { refName: string; start: number; end: number } | undefined
}): MenuItem[] {
  const assemblyName = view.assemblyNames[0]
  const declared = new Set(readConfObject(track, 'assemblyNames') as string[])
  return !region || assemblyName === undefined || declared.size < 3
    ? []
    : syntenyRegionMenuItems({
        label: ALL_ASSEMBLIES_LABEL,
        region: { assemblyName, ...region },
        session,
        openTracks: [track],
        anchorTracks: anchorPanelTracks(view.tracks),
        sourceView: containingPanelStack(view) ?? view,
      })
}
