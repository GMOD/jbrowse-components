import React, { useState } from 'react'
import { observer } from 'mobx-react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui/Menu'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSession } from '@jbrowse/core/util'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import TrackLabelMenu from './TrackLabelMenu'

const DropdownTrackSelector = observer(function ({
  model,
  tracks,
  extraMenuItems,
  children,
  onClick,
}: {
  model: HierarchicalTrackSelectorModel
  tracks: AnyConfigurationModel[]
  extraMenuItems: MenuItem[]
  onClick?: () => void
  children: React.ReactElement
}) {
  const { view } = model
  const [open, setOpen] = useState(false)
  const session = getSession(model)
  return view ? (
    <CascadingMenuButton
      closeAfterItemClick={false}
      onClick={onClick}
      menuItems={[
        ...tracks.map(t => ({
          type: 'checkbox' as const,
          label: (
            <>
              <SanitizedHTML html={getTrackName(t, session)} />{' '}
              <TrackLabelMenu
                id={t.trackId}
                trackId={t.trackId}
                model={model}
                conf={t}
                setOpen={setOpen}
                stopPropagation
              />
            </>
          ),
          checked: view.tracks.some(
            (f: { configuration: AnyConfigurationModel }) =>
              f.configuration === t,
          ),
          onClick: () => {
            if (!open) {
              if (model.view.toggleTrack(t.trackId)) {
                model.addToRecentlyUsed(t.trackId)
              }
            }
          },
        })),
        ...extraMenuItems,
      ]}
    >
      {children}
    </CascadingMenuButton>
  ) : null
})

export default DropdownTrackSelector
