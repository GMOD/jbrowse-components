import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getEnv, getSession } from '@jbrowse/core/util'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { Badge } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

const ShoppingCart = observer(function ShoppingCart({
  model,
}: {
  model: {
    clearSelection: () => void
    selection: AnyConfigurationModel[]
  }
}) {
  const session = getSession(model)
  const showShortcuts =
    'showMenuShortcuts' in session ? session.showMenuShortcuts : true
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
      showShortcuts={showShortcuts}
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
                  for (const track of selection) {
                    // @ts-expect-error
                    session.deleteTrackConf?.(track)
                  }
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
