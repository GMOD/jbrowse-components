import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  toggleButton: {
    border: 'none',
  },
  indent: {
    marginLeft: theme.spacing(4),
  },
  selected: {
    backgroundColor: theme.palette.action.selected,
  },
}))

const HeaderTrackSelectorButton = observer(function HeaderTrackSelectorButton({
  model,
  indent,
}: {
  model: LinearGenomeViewModel
  indent?: boolean
}) {
  const { classes, cx } = useStyles()
  const { isTrackSelectorOpen } = model
  return (
    <IconButton
      color={isTrackSelectorOpen ? 'primary' : 'default'}
      onClick={() => {
        model.toggleTrackSelector()
      }}
      className={cx(
        classes.toggleButton,
        indent && classes.indent,
        isTrackSelectorOpen ? classes.selected : undefined,
      )}
      title={
        isTrackSelectorOpen ? 'Close track selector' : 'Open track selector'
      }
      value="track_select"
    >
      <TrackSelectorIcon />
    </IconButton>
  )
})

export default HeaderTrackSelectorButton
