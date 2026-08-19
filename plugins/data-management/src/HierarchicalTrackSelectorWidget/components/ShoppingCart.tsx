import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { buildMultiTrackMenuItems } from '@jbrowse/core/ui/multiTrackMenuItems'
import {
  getEnv,
  getSession,
  isSessionWithDeleteTrackConf,
} from '@jbrowse/core/util'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { Badge } from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ShoppingCart = observer(function ShoppingCart({
  model,
}: {
  model: {
    clearSelection: () => void
    selection: AnyConfigurationModel[]
  }
}) {
  const session = getSession(model)
  const { selection } = model
  const { pluginManager } = getEnv(model)
  const { adminMode, sessionTracks } = session
  const s = new Set<string>(sessionTracks?.map(t => t.trackId))
  const canEdit = (t: string) => adminMode || s.has(t)
  const items = buildMultiTrackMenuItems(pluginManager, { session })
  const canDeleteAll =
    isSessionWithDeleteTrackConf(session) &&
    selection.every(
      elt => canEdit(elt.trackId) && elt.type !== 'ReferenceSequenceTrack',
    )

  return selection.length ? (
    <CascadingMenuButton
      data-testid="hts-shopping-cart"
      tooltip="Selected tracks"
      menuItems={[
        {
          label: 'Clear selection',
          onClick: () => {
            model.clearSelection()
          },
        },
        ...(canDeleteAll
          ? [
              {
                label: 'Delete tracks',
                onClick: () => {
                  // one pass, not one re-render per track; the selection prunes
                  // the deleted configs itself (see the model's `selection`)
                  transaction(() => {
                    for (const track of selection) {
                      session.deleteTrackConf(track)
                    }
                  })
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
