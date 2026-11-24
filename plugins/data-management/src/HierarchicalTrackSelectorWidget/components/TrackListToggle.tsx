import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import HistoryIcon from '@mui/icons-material/History'
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  group: {
    marginLeft: 'auto',
  },
  button: {
    padding: 2,
    border: 'none',
    '& svg': {
      fontSize: 16,
    },
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.14),
      color: theme.palette.primary.main,
    },
  },
}))

/**
 * All tracks, Favorites and Recently used as three small icons, since few
 * people keep either list
 */
const TrackListToggle = observer(function TrackListToggle({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label="Which tracks"
      className={classes.group}
      value={model.trackList}
      onChange={(_event, value) => {
        if (value === 'all' || value === 'favorites' || value === 'recent') {
          model.setTrackList(value)
        }
      }}
    >
      <Tooltip title="All tracks">
        <ToggleButton
          value="all"
          aria-label="All tracks"
          className={classes.button}
          data-testid="list-all"
        >
          <LayersOutlinedIcon />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Favorites">
        <ToggleButton
          value="favorites"
          aria-label="Favorites"
          className={classes.button}
          data-testid="list-favorites"
        >
          <StarBorderIcon />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Recently used">
        <ToggleButton
          value="recent"
          aria-label="Recently used"
          className={classes.button}
          data-testid="list-recent"
        >
          <HistoryIcon />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  )
})

export default TrackListToggle
