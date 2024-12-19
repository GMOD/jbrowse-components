import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getEnv, getSession } from '@jbrowse/core/util'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { Badge } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

const ShoppingCart = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const session = getSession(model)
  const { selection } = model
  const { pluginManager } = getEnv(model)
  const { adminMode, sessionTracks } = session
  const s = new Set<string>(sessionTracks?.map(t => t.trackId))
  const canEdit = (t: string) => adminMode || s.has(t)
  const items = pluginManager.evaluateExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    [],
    { session },
  ) as MenuItem[]

  return selection.length ? (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Clear selection',
          onClick: () => {
            model.clearSelection()
          },
        },
        ...(selection.every(elt => canEdit(elt.trackId))
          ? [
              {
                label: 'Delete tracks',
                onClick: () => {
                  // @ts-expect-error
                  selection.forEach(s => session.deleteTrackConf?.(s))
                },
              },
            ]
          : []),

        ...items.map(item => ({
          ...item,
          ...('onClick' in item
            ? {
                onClick: () => {
                  item.onClick(model)
                },
              }
            : {}),
        })),
      ]}
    >
      <Badge badgeContent={selection.length} color="primary">
        <ShoppingCartIcon />
      </Badge>
    </CascadingMenuButton>
  ) : null
})

export default ShoppingCart
