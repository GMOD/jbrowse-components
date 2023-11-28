import React from 'react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

// icons
import HistoryIcon from '@mui/icons-material/History'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import DropdownTrackSelector from './DropdownTrackSelector'

const RecentlyUsedTracks = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { view, recentlyUsedTracks } = model
  return view ? (
    <DropdownTrackSelector
      model={model}
      tracks={recentlyUsedTracks}
      extraMenuItems={
        recentlyUsedTracks.length
          ? [
              { type: 'divider' as const },
              {
                label: 'Clear recently used',
                onClick: () => model.clearRecentlyUsed(),
              },
            ]
          : [
              {
                label: 'No recently used',
                onClick: () => {},
              },
            ]
      }
    >
      <Tooltip title="Recently used tracks">
        <HistoryIcon />
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default RecentlyUsedTracks
