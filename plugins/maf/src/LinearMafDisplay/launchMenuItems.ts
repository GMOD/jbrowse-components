import { LAUNCH_LABEL } from '@jbrowse/core/ui'
import NotesIcon from '@mui/icons-material/Notes'

import {
  mafSyntenyLaunchItems,
  sampleNavigationItems,
  visibleRowTargets,
} from './components/sampleNavigationItems.ts'
import { openSubsequenceWidget } from './openSubsequenceWidget.ts'
import { ZOOM_IN_FOR_BAND, zoomGatedItem } from './trackMenuItems.ts'

import type { Sample } from '../types.ts'
import type { SampleNavigationModel } from './components/sampleNavigationItems.ts'
import type {
  MafSyntenyHost,
  MafSyntenyLaunchModel,
} from './launchMafRowSynteny.ts'
import type { SubsequenceHost } from './openSubsequenceWidget.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { NotificationSink } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The display slice these items read, composed from the three the drag-menu's
 * own items already declare rather than naming the model — same reason they are
 * structural there: it keeps this a plain function a literal can drive.
 */
export type MafLaunchModel = SampleNavigationModel &
  MafSyntenyLaunchModel &
  SubsequenceHost & {
    samples: Sample[]
    sources: unknown[]
    showSummary: boolean
    view: { width: number }
  }

/**
 * The subsequence entry, off past the summary floor.
 *
 * The widget reads per-base sequence out of the alignment file, which is the
 * one thing the summary tier exists not to download — the display's own detail
 * fetch has already refused it there. Offered anyway, it opened a widget that
 * asked the worker for the whole span with no measurement, and the FASTA
 * builder preallocates one byte per sample per base before it starts: a 5 Mb
 * window over HPRC's 464 haplotypes is a 2.3 GB allocation.
 *
 * The RPC now measures and refuses (`MafGetSequences`), so this is the reason
 * said in advance rather than the only thing stopping it. Same wording the two
 * band toggles use for the same override.
 *
 * Shared with the drag menu's two entries, which reach the same widget from a
 * rubberband over the summary bars.
 */
export function subsequenceItem(item: MenuItem, showSummary: boolean) {
  return zoomGatedItem(item, showSummary ? ZOOM_IN_FOR_BAND : undefined)
}

/**
 * Everything the drag-selection menu offers, over the visible window instead.
 *
 * All three entries — the subsequences, the per-sample jump, the two-row
 * synteny view — used to be reachable only from a menu a drag opens, so they
 * were found by people who already knew they were there. A reader who has
 * navigated to a locus has named one just as well as a rubberband does, and the
 * window is the span the drag would have covered.
 *
 * The submenu is the function form: naming the per-species entries walks the
 * buffered region (`rowNavigationTargets`), and the track menu is opened far
 * more often than this row is.
 */
export function mafLaunchMenuItems({
  session,
  model,
  view,
}: {
  session: MafSyntenyHost & NotificationSink
  model: MafLaunchModel
  view: LinearGenomeViewModel
}): MenuItem[] {
  const subMenu = (): MenuItem[] => {
    const targets = visibleRowTargets(session, model)
    return [
      subsequenceItem(
        {
          label: 'View subsequences (visible region)',
          icon: NotesIcon,
          disabled: model.samples.length === 0,
          onClick: () => {
            // `width - 1`, the last pixel the window paints, not `width`: the
            // entries below take the window from the same two pixels, and a
            // right edge one past it puts one extra base in the widget and not
            // in them.
            openSubsequenceWidget(
              session,
              model,
              view,
              0,
              view.width - 1,
              model.samples,
            )
          },
        },
        model.showSummary,
      ),
      ...sampleNavigationItems(session, model, targets),
      ...mafSyntenyLaunchItems(session, model, targets),
    ]
  }
  return [{ label: LAUNCH_LABEL, type: 'subMenu', subMenu }]
}
