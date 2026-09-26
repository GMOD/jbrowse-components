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

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const ShoppingCart = observer(function ShoppingCart({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const session = getSession(model)
  const { selection, sessionTrackIds } = model
  const { pluginManager } = getEnv(model)
  const items = buildMultiTrackMenuItems(pluginManager, { session, model })
  const canDeleteAll =
    isSessionWithDeleteTrackConf(session) &&
    selection.every(
      elt =>
        (session.adminMode || sessionTrackIds.has(elt.trackId)) &&
        elt.type !== 'ReferenceSequenceTrack',
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

        // spread as contributed: a contributor closes over the model it was
        // built with, so there is nothing to rewrap — and rewrapping reached
        // only the top level, passing over a contributed submenu's children
        ...items,
      ]}
    >
      <Badge badgeContent={selection.length} color="primary">
        <ShoppingCartIcon />
      </Badge>
    </CascadingMenuButton>
  ) : null
})

export default ShoppingCart
