import React, { useState } from 'react'
import { observer } from 'mobx-react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { MenuItem } from '@jbrowse/core/ui/Menu'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'

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
  return view ? (
    <CascadingMenuButton
      closeAfterItemClick={false}
      onClick={onClick}
      menuItems={[
        ...tracks.map(t => ({
          type: 'checkbox' as const,
          label: (
            <>
              <SanitizedHTML html={readConfObject(t, 'name')} />{' '}
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
              model.view.toggleTrack(t.trackId)
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
