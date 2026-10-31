import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import NotesIcon from '@mui/icons-material/Notes'

import {
  mafSyntenyLaunchItems,
  sampleNavigationItems,
  visibleRowTargets,
} from './components/sampleNavigationItems.ts'
import { openSubsequenceWidget } from './openSubsequenceWidget.ts'
import { ZOOM_IN_FOR_BAND, zoomGatedItem } from './trackMenuItems.ts'

import type { MafSource } from '../types.ts'
import type { SampleNavigationModel } from './components/sampleNavigationItems.ts'
import type {
  MafSyntenyHost,
  MafSyntenyLaunchModel,
} from './launchMafRowSynteny.ts'
import type { SubsequenceHost } from './openSubsequenceWidget.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { NotificationSink } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The display slice these items read, composed from the drag-menu items' own
 * slices so a plain literal can drive it.
 */
export type MafLaunchModel = SampleNavigationModel &
  MafSyntenyLaunchModel &
  SubsequenceHost & {
    clusterableSources: MafSource[]
    sources: unknown[]
    coarseTierActive: boolean
    view: { width: number }
  }

/**
 * Everything the drag-selection menu offers, over the visible window instead.
 * The submenu is the function form, since naming per-species entries walks the
 * buffered region (`rowNavigationTargets`).
 */
export function mafLaunchMenuItems({
  session,
  model,
  view,
  pluginManager,
}: {
  session: MafSyntenyHost & NotificationSink
  model: MafLaunchModel
  view: LinearGenomeViewModel
  pluginManager: PluginManager
}): MenuItem[] {
  const subMenu = (): MenuItem[] => {
    const targets = visibleRowTargets(session, model)
    // The widget reads per-base sequence from the alignment file, which the
    // summary tier exists not to download.
    const zoomHint = model.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined
    return [
      zoomGatedItem(
        {
          label: 'View subsequences (visible region)',
          icon: NotesIcon,
          disabled: model.clusterableSources.length === 0,
          onClick: () => {
            // `width - 1`, the last pixel the window paints, matching the
            // entries below.
            openSubsequenceWidget(
              session,
              model,
              view,
              0,
              view.width - 1,
              model.clusterableSources,
            )
          },
        },
        zoomHint,
      ),
      ...sampleNavigationItems(session, model, targets, pluginManager),
      ...mafSyntenyLaunchItems(session, model, targets, pluginManager),
    ]
  }
  return [{ label: LAUNCH_LABEL, type: 'subMenu', subMenu }]
}
