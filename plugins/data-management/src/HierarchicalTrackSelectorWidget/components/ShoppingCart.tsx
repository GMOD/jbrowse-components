import React from 'react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession, getEnv } from '@jbrowse/core/util'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { Badge } from '@mui/material'
import { observer } from 'mobx-react'

// icons

// locals
import type { HierarchicalTrackSelectorModel } from '../model'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

const ShoppingCart = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { selection } = model
  const { pluginManager } = getEnv(model)
  const session = getSession(model)
  const items = pluginManager.evaluateExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    [],
    { session },
  ) as MenuItem[]

  return selection.length ? (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Clear',
          onClick: () => {
            model.clearSelection()
          },
        },
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
