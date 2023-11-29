import React from 'react'
import { Badge, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

// icons
import GradeIcon from '@mui/icons-material/Grade'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import DropdownTrackSelector from './DropdownTrackSelector'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  smallBadge: {
    height: 14,
  },
})
const FavoriteTracks = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
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
        <Badge
          classes={{ badge: classes.smallBadge }}
          color="secondary"
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          style={{ marginRight: 10 }}
          badgeContent={model.favoritesCounter}
        >
          <GradeIcon />
        </Badge>
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default FavoriteTracks
