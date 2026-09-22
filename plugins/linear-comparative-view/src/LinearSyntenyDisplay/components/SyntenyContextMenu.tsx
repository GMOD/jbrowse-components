import { ContextMenu } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import SyncAltIcon from '@mui/icons-material/SyncAlt'

import { centerStackOnFeature } from '../../SyntenyFeatureDetail/centerOnFeature.ts'
import { bandMoveTargets } from '../bandMoveTargets.ts'
import { moveMatchingPanel } from '../moveMatchingPanel.ts'
import { syntenyWidgetFeature } from '../syntenyWidgetFeature.ts'

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
  // read at render, so the last-resort reporter below cannot itself throw on a
  // display destroyed while its move was in flight
  const session = getSession(model)
  const { clientX, clientY, feature } = anchorEl

  // MOVE ONE PANEL, KEEPING THE OTHER, which is what someone whose panels have
  // drifted out of correspondence actually wants and what centering cannot
  // express: that moves BOTH panels onto the whole alignment, which for a
  // chain-sized feature is nowhere near the window either of them was showing.
  // Which items those are, and what each one needs, is `bandMoveTargets` — the
  // decision is worth testing without a render.
  const targets = bandMoveTargets({
    level: model.level,
    topView: model.parentHelper.rowPair?.v0,
    bottomView: model.parentHelper.rowPair?.v1,
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
          label: 'Center view on this feature',
          onClick: () => {
            const problems = centerStackOnFeature({
              view: model.view,
              level: model.level,
              feat: syntenyWidgetFeature(feature),
              assemblyManager: session.assemblyManager,
            })
            if (problems.length > 0) {
              session.notify(problems.join(' ... '), 'warning')
            }
          },
        },
      ]}
    />
  )
}
