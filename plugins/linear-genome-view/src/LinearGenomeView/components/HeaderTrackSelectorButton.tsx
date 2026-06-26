import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  toggleButton: {
    height: 44,
    border: 'none',
    marginLeft: theme.spacing(4),
  },
  selected: {
    color: theme.palette.primary.main,
  },
}))

const HeaderTrackSelectorButton = observer(function HeaderTrackSelectorButton({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes, cx } = useStyles()
  const { isTrackSelectorOpen } = model
  return (
    <IconButton
      onClick={() => {
        model.toggleTrackSelector()
      }}
      className={cx(
        classes.toggleButton,
        isTrackSelectorOpen ? classes.selected : undefined,
      )}
      title={isTrackSelectorOpen ? 'Close track selector' : 'Open track selector'}
      value="track_select"
    >
      <TrackSelectorIcon />
    </IconButton>
  )
})

export default HeaderTrackSelectorButton
