import { containingPanelStack } from '../LGVSyntenyDisplay/matePanelNavigation.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The synteny datasets a linear view can launch from: its own open tracks,
 * plus — when it is a ROW of a synteny stack — the tracks drawn on the bands
 * beside it. A band's track lives on the stack's level, not in any row, so a
 * row's own track list never held the dataset that put it there and the
 * rubberband on a launched stack offered nothing. Now it offers the same
 * dialog, anchored on that row: which is how a stack is re-anchored on any of
 * its genomes without relaunching from a plain view.
 *
 * Every level's tracks, not the adjacent bands' alone. The dialog discovers
 * which assemblies align to the row's window in the dataset it reads, so a
 * dataset from a band two rows away is still one that names this row's
 * assembly — or the dialog says it aligns to nothing here, which is also an
 * answer.
 */
export function launchableTrackConfs(
  view: LinearGenomeViewModel,
): AnyConfigurationModel[] {
  const stack = containingPanelStack(view)
  return [
    ...view.tracks.map(track => track.configuration),
    ...(stack?.levels ?? []).flatMap(level =>
      level.tracks.map(track => track.configuration),
    ),
  ]
}
