import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  getEnv,
  getSession,
  isSessionWithDeleteTrackConf,
} from '@jbrowse/core/util'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { Badge } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui/Menu'
import type { AbstractSessionModel } from '@jbrowse/core/util'

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'TrackSelector-multiTrackMenuItems': {
      args: MenuItem[]
      result: MenuItem[]
      props: { session: AbstractSessionModel }
    }
  }
}

const ShoppingCart = observer(function ShoppingCart({
  model,
}: {
  model: {
    clearSelection: () => void
    selection: (AnyConfigurationModel | undefined)[]
  }
}) {
  const session = getSession(model)
  const { selection } = model
  const { pluginManager } = getEnv(model)
  const { adminMode, sessionTracks } = session
  const s = new Set<string>(sessionTracks?.map(t => t.trackId))
  const canEdit = (t: string) => adminMode === true || s.has(t)
  const items = pluginManager.evaluateExtensionPoint(
    'TrackSelector-multiTrackMenuItems',
    [],
    { session },
  )
  const definedSelection = selection.filter(
    (elt): elt is AnyConfigurationModel => !!elt,
  )
  const canDeleteAll =
    isSessionWithDeleteTrackConf(session) &&
    definedSelection.every(
      elt => canEdit(elt.trackId) && elt.type !== 'ReferenceSequenceTrack',
    )

  return selection.length ? (
    <CascadingMenuButton
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
                  for (const track of definedSelection) {
                    session.deleteTrackConf(track)
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
