import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  toggleButton: {
    height: 44,
    border: 'none',
    marginLeft: theme.spacing(4),
  },
}))

const HeaderTrackSelectorButton = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <IconButton
      onClick={model.activateTrackSelector}
      className={classes.toggleButton}
      title="Open track selector"
      value="track_select"
    >
      <TrackSelectorIcon />
    </IconButton>
  )
})

export default HeaderTrackSelectorButton
