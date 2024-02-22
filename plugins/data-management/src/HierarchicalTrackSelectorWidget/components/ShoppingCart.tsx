import React from 'react'
import { Badge } from '@mui/material'
import { observer } from 'mobx-react'
import { MenuItem } from '@jbrowse/core/ui/Menu'
import { getSession, getEnv } from '@jbrowse/core/util'

// icons
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'

// locals
import { HierarchicalTrackSelectorModel } from '../model'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

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
        { label: 'Clear', onClick: () => model.clearSelection() },
        ...items.map(item => ({
          ...item,
          ...('onClick' in item ? { onClick: () => item.onClick(model) } : {}),
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
