import HistoryIcon from '@mui/icons-material/History'
import { Badge, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import DropdownTrackSelector from './DropdownTrackSelector'
import {
  badgeAnchorOrigin,
  getDropdownMenuItems,
  useSmallBadgeStyles,
} from './trackListStyles'

import type { HierarchicalTrackSelectorModel } from '../../model'

const RecentlyUsedTracks = observer(function ({ model }: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useSmallBadgeStyles()
  const { view, recentlyUsedTracks, recentlyUsedCounter } = model

  return view ? (
    <DropdownTrackSelector
      onClick={() => model.setRecentlyUsedCounter(0)}
      tracks={recentlyUsedTracks}
      model={model}
      extraMenuItems={getDropdownMenuItems({
        hasTracks: recentlyUsedTracks.length > 0,
        clearLabel: 'Clear recently used',
        emptyLabel: 'No recently used',
        onClear: () => model.clearRecentlyUsed(),
      })}
    >
      <Tooltip title="Recently used tracks">
        <Badge
          classes={{ badge: classes.smallBadge }}
          color="secondary"
          anchorOrigin={badgeAnchorOrigin}
          badgeContent={recentlyUsedCounter}
        >
          <HistoryIcon />
        </Badge>
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default RecentlyUsedTracks
