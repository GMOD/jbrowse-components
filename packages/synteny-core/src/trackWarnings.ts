import { getConf } from '@jbrowse/core/configuration'

import type { ComparativeWarning } from './SyntenyFetchStateMixin.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * One track's render warnings under the name to report them by.
 *
 * The warning rows are the display's own `ComparativeWarning`, so a field added
 * there is a compile error at each surface that tabulates them rather than a
 * column silently dropped.
 */
export interface TrackWarning {
  name: string
  warnings: ComparativeWarning[]
}

/**
 * The minimum a display has to be to contribute a warning row. Deliberately
 * `IStateTreeNode` and not `IAnyStateTreeNode`: the latter resolves to `any` and
 * would switch off checking on the two members below.
 *
 * `parentTrack` is named by what `getConf` needs of it rather than as a node —
 * `AbstractTrackModel` carries no MST brand, so requiring one here rejects both
 * views' real displays.
 */
export interface WarningSource extends IStateTreeNode {
  parentTrack: { configuration: AnyConfigurationModel }
  warnings: ComparativeWarning[]
}

/**
 * Both comparative views can show several synteny tracks over one assembly
 * pair, so a warning without a track name leaves the user to guess which file
 * raised it — and the commonest one (`swappedAssembliesWarning`) is raised
 * verbatim by every display that hits it, so with N tracks the report was N
 * identical rows.
 *
 * Resolved here, once, rather than in either view's render: the name is a
 * `getConf` per track, and the dotplot's caller re-ran it on every pointermove
 * of a selection drag.
 *
 * Displays that raised nothing are dropped, so the result is empty exactly when
 * there is nothing to report — which is what both views gate their affordance
 * on.
 *
 * Pass the type-filtered display list (`dotplotDisplays`,
 * `allSyntenyDisplays`), never `tracks[i].displays[0]`: those lists are not
 * index-aligned with `tracks`, so pairing them positionally labels a warning
 * with the wrong track's name the moment they differ in length. The name comes
 * off each display's own `parentTrack` for that reason.
 */
export function collectTrackWarnings(
  displays: WarningSource[],
): TrackWarning[] {
  return displays.flatMap(display =>
    display.warnings.length > 0
      ? [
          {
            name: getConf(display.parentTrack, 'name') as string,
            warnings: display.warnings,
          },
        ]
      : [],
  )
}
