import { Badge, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import DropdownTrackSelector from './DropdownTrackSelector.tsx'
import {
  badgeAnchorOrigin,
  getDropdownMenuItems,
  useSmallBadgeStyles,
} from './trackListStyles.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Badge button (favorites / recently-used) opening a dropdown of tracks with a
// clear action; the badge content is a "new since last opened" counter that the
// onOpen callback resets to zero.
const BadgeDropdownTracks = observer(function BadgeDropdownTracks({
  model,
  tracks,
  counter,
  icon,
  tooltip,
  clearLabel,
  emptyLabel,
  onClear,
  onOpen,
}: {
  model: HierarchicalTrackSelectorModel
  tracks: AnyConfigurationModel[]
  counter: number
  icon: React.ReactNode
  tooltip: string
  clearLabel: string
  emptyLabel: string
  onClear: () => void
  onOpen: () => void
}) {
  const { classes } = useSmallBadgeStyles()
  return model.view ? (
    <DropdownTrackSelector
      onClick={() => {
        onOpen()
      }}
      tracks={tracks}
      model={model}
      extraMenuItems={getDropdownMenuItems({
        hasTracks: tracks.length > 0,
        clearLabel,
        emptyLabel,
        onClear,
      })}
    >
      <Tooltip title={tooltip}>
        <Badge
          classes={{ badge: classes.smallBadge }}
          color="secondary"
          anchorOrigin={badgeAnchorOrigin}
          className={classes.margin}
          badgeContent={counter}
        >
          {icon}
        </Badge>
      </Tooltip>
    </DropdownTrackSelector>
  ) : null
})

export default BadgeDropdownTracks
