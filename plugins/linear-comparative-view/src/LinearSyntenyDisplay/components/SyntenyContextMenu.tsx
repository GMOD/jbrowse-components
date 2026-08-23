import { ContextMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { bandMoveTargets } from '../bandMoveTargets.ts'
import { moveMatchingPanel } from '../moveMatchingPanel.ts'

import type { LinearSyntenyDisplayModel } from '../model.ts'
import type { ClickCoord } from './util.ts'

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
  // read at render, so the last-resort reporter below cannot itself throw on a
  // display destroyed while its move was in flight
  const session = getSession(model)
  const { clientX, clientY, feature } = anchorEl
  const topView = view.views[model.level]
  const bottomView = view.views[model.level + 1]

  // MOVE ONE PANEL, KEEPING THE OTHER, which is what someone whose panels have
  // drifted out of correspondence actually wants and what "Center on feature"
  // cannot express: that moves BOTH panels, to the midpoint of the whole
  // alignment, which for a chain-sized feature is nowhere near the window
  // either of them was showing. Which items those are, and what each one needs,
  // is `bandMoveTargets` — the decision is worth testing without a render.
  const targets = bandMoveTargets({
    level: model.level,
    topView,
    bottomView,
    feat: feature,
    hasCigar: model.featureData?.hasCigar ?? false,
  })

  return (
    <ContextMenu
      anchor={{ clientX, clientY }}
      onClose={() => {
        onClose()
      }}
      menuItems={[
        ...targets.map(
          ({ label, toMate, movingView, stayingIndex, window }) => ({
            label,
            icon: SyncAltIcon,
            onClick: () => {
              moveMatchingPanel({
                model,
                feat: feature,
                window,
                movingView,
                stayingIndex,
                toMate,
              }).catch((e: unknown) => {
                session.notifyError(`${e}`, e)
              })
            },
          }),
        ),
        {
          label: 'Center on feature',
          onClick: () => {
            const { start, end, refName, mate } = feature

            if (!topView || !bottomView) {
              return
            }

            const center1 = (start + end) / 2
            const center2 = (mate.start + mate.end) / 2

            topView.centerAt(center1, refName)
            bottomView.centerAt(center2, mate.refName)
          },
        },
      ]}
    />
  )
}
