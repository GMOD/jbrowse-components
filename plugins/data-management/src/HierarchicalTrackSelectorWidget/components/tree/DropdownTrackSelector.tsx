import React, { useState } from 'react'
import { observer } from 'mobx-react'
// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import TrackLabelMenu from './TrackLabelMenu'
import { MenuItem } from '@jbrowse/core/ui/Menu'

const DropdownTrackSelector = observer(function ({
  model,
  tracks,
  extraMenuItems,
  children,
}: {
  model: HierarchicalTrackSelectorModel
  tracks: AnyConfigurationModel[]
  extraMenuItems: MenuItem[]
  children: React.ReactElement
}) {
  const { view } = model
  const [open, setOpen] = useState(false)
  return view ? (
    <CascadingMenuButton
      closeAfterItemClick={false}
      menuItems={[
        ...tracks.map(t => ({
          type: 'checkbox' as const,
          label: (
            <div>
              {readConfObject(t, 'name')}{' '}
              <TrackLabelMenu
                id={t.trackId}
                trackId={t.trackId}
                model={model}
                conf={t}
                setOpen={setOpen}
                stopPropagation
              />
            </div>
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
