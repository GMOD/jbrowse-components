import { ContextMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { ribbonMatePanelLocString } from '../ribbonPanelNavigation.ts'

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

  // MOVE ONE PANEL, KEEPING THE OTHER, which is what a reader who has drifted
  // out of correspondence actually wants and what "Center on feature" below
  // cannot express: it moves BOTH panels, to the midpoint of the whole
  // alignment, which for a chain-sized feature is nowhere near the window
  // either of them was showing.
  //
  // TWO ITEMS RATHER THAN ONE, because a band is drawn BETWEEN two panels and
  // "the other panel" has no answer from here — unlike the same item on the
  // LGV track menu, where the panel that was right-clicked is the one that
  // stays. Naming the rows top/bottom is the only phrasing that is true
  // wherever in a taller stack this band sits.
  function moveItem(label: string, moveMate: boolean): MenuItem[] {
    const sourceView = moveMate ? l1 : l2
    const targetView = moveMate ? l2 : l1
    if (!sourceView || !targetView) {
      return []
    }
    return [
      {
        label,
        icon: SyncAltIcon,
        onClick: () => {
          const locString = ribbonMatePanelLocString({
            feat: feature,
            sourceView,
            moveMate,
          })
          if (!locString) {
            return
          }
          // navToLocString rather than navTo, so a panel showing some other
          // contig switches displayed regions instead of throwing, and it is
          // awaited only to report the failure
          targetView.navToLocString(locString).catch((e: unknown) => {
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
