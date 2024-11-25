import React from 'react'
import GradeIcon from '@mui/icons-material/Grade'
import { Badge, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import DropdownTrackSelector from './DropdownTrackSelector'
import type { HierarchicalTrackSelectorModel } from '../../model'

const useStyles = makeStyles()({
  smallBadge: {
    height: 14,
  },
  margin: {
    marginRight: 10,
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
      onClick={() => {
        model.setFavoritesCounter(0)
      }}
      tracks={favoriteTracks}
      model={model}
      extraMenuItems={
        favoriteTracks.length
          ? [
              { type: 'divider' as const },
              {
                label: 'Clear favorites',
                onClick: () => {
                  model.clearFavorites()
                },
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
          className={classes.margin}
          badgeContent={model.favoritesCounter}
        >
          <GradeIcon />
        </Badge>
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default FavoriteTracks
