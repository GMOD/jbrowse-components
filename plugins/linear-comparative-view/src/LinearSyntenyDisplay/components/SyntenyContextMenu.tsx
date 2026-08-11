import { ContextMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { moveMatchingPanel } from '../moveMatchingPanel.ts'

import type { LinearSyntenyDisplayModel } from '../model.ts'
import type { ClickCoord } from './util.ts'
import type { MenuItem } from '@jbrowse/core/ui'

export default function SyntenyContextMenu({
  model,
  onClose,
  anchorEl,
}: {
  onClose: () => void
  model: LinearSyntenyDisplayModel
  anchorEl: ClickCoord
}) {
  const { view } = model
  const { clientX, clientY, feature } = anchorEl
  const l1 = view.views[model.level]
  const l2 = view.views[model.level + 1]

  // MOVE ONE PANEL, KEEPING THE OTHER, which is what someone whose panels have
  // drifted out of correspondence actually wants and what "Center on feature"
  // cannot express: that moves BOTH panels, to the midpoint of the whole
  // alignment, which for a chain-sized feature is nowhere near the window
  // either of them was showing.
  //
  // ONLY WHERE THERE IS A CIGAR TO WALK. Without one the mate position can only
  // be interpolated across the block, and a menu item that navigates a panel to
  // a straight-line guess and shows it flush against its neighbour is
  // presenting a guess as a correspondence. A PIF's coarse tier -- what serves
  // whole-genome zoom -- is CIGAR-less by construction, and the skew inside one
  // coarse row is not bounded by its 10kb split threshold, since smaller indels
  // accumulate without triggering a split. So the items are absent at that zoom
  // rather than approximate: `hasCigar` is per-fetch and flips to true when the
  // fine tier loads.
  //
  // TWO ITEMS RATHER THAN ONE, because a band is drawn BETWEEN two panels and
  // "the other panel" has no answer from a click on the band itself -- unlike
  // the same item on the LGV track menu, where the panel that was right-clicked
  // is the one that stays. Naming the rows top/bottom is the only phrasing that
  // stays true wherever in a taller stack this band sits.
  function moveItem(label: string, toMate: boolean): MenuItem[] {
    const stayingView = toMate ? l1 : l2
    const movingView = toMate ? l2 : l1
    if (!stayingView || !movingView || !model.featureData?.hasCigar) {
      return []
    }
    return [
      {
        label,
        icon: SyncAltIcon,
        onClick: () => {
          moveMatchingPanel({
            model,
            feat: feature,
            stayingView,
            movingView,
            toMate,
          }).catch((e: unknown) => {
            getSession(model).notifyError(`${e}`, e)
          })
        },
      },
    ]
  }

  return (
    <ContextMenu
      anchor={{ clientX, clientY }}
      onClose={() => {
        onClose()
      }}
      menuItems={[
        ...moveItem('Move bottom panel to the matching region', true),
        ...moveItem('Move top panel to the matching region', false),
        {
          label: 'Center on feature',
          onClick: () => {
            const { start, end, refName, mate } = feature

            if (!l1 || !l2) {
              return
            }

            const center1 = (start + end) / 2
            const center2 = (mate.start + mate.end) / 2

            l1.centerAt(center1, refName)
            l2.centerAt(center2, mate.refName)
          },
        },
      ]}
    />
  )
}
