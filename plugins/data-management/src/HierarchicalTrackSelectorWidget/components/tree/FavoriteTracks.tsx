import React from 'react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

// icons
import GradeIcon from '@mui/icons-material/Grade'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import DropdownTrackSelector from './DropdownTrackSelector'

const FavoriteTracks = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { view, favoriteTracks } = model
  return view ? (
    <DropdownTrackSelector
      tracks={favoriteTracks}
      model={model}
      extraMenuItems={
        favoriteTracks.length
          ? [
              { type: 'divider' as const },
              {
                label: 'Clear favorites',
                onClick: () => model.clearFavorites(),
              },
            ]
          : [
              {
                label: 'No favorite tracks yet',
                onClick: () => {},
              },
            ]
      }
    >
      <Tooltip title="Favorite tracks">
        <GradeIcon />
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default FavoriteTracks
