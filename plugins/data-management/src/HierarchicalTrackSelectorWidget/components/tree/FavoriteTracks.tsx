import GradeIcon from '@mui/icons-material/Grade'
import { Badge, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import DropdownTrackSelector from './DropdownTrackSelector.tsx'
import {
  badgeAnchorOrigin,
  getDropdownMenuItems,
  useSmallBadgeStyles,
} from './trackListStyles.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const FavoriteTracks = observer(function FavoriteTracks({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useSmallBadgeStyles()
  const { view, favoriteTracks, favoritesCounter } = model

  return view ? (
    <DropdownTrackSelector
      onClick={() => {
        model.setFavoritesCounter(0)
      }}
      tracks={favoriteTracks}
      model={model}
      extraMenuItems={getDropdownMenuItems({
        hasTracks: favoriteTracks.length > 0,
        clearLabel: 'Clear favorites',
        emptyLabel: 'No favorite tracks yet',
        onClear: () => {
          model.clearFavorites()
        },
      })}
    >
      <Tooltip title="Favorite tracks">
        <Badge
          classes={{ badge: classes.smallBadge }}
          color="secondary"
          anchorOrigin={badgeAnchorOrigin}
          className={classes.margin}
          badgeContent={favoritesCounter}
        >
          <GradeIcon />
        </Badge>
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default FavoriteTracks
