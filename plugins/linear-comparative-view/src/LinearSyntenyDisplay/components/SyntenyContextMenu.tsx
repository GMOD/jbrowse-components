import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model'
import type { LinearSyntenyDisplayModel } from '../model'
import type { Feature } from '@jbrowse/core/util'

interface ClickCoord {
  clientX: number
  clientY: number
  feature: { f: Feature }
}

export default function SyntenyContextMenu({
  model,
  onClose,
  anchorEl,
}: {
  onClose: () => void
  model: LinearSyntenyDisplayModel
  anchorEl: ClickCoord
}) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const { clientX, clientY, feature } = anchorEl
  return (
    <Menu
      onMenuItemClick={(_, callback) => {
        callback()
        onClose()
      }}
      anchorReference="anchorPosition"
      anchorPosition={{ top: clientY, left: clientX }}
      onClose={onClose}
      open={Boolean(anchorEl)}
      menuItems={[
        {
          label: 'Center on feature',
          onClick: () => {
            const { f } = feature
            const start = f.get('start')
            const end = f.get('end')
            const refName = f.get('refName')
            const mate = f.get('mate')

            const l1 = view.views[model.level]!
            const l2 = view.views[model.level + 1]!

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
