import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { IconButton, Paper } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearHicDisplayModel } from '../model'

const useStyles = makeStyles()(theme => ({
  controls: {
    position: 'absolute',
    right: 4,
    top: 4,
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    background: theme.palette.background.paper,
  },
  button: {
    padding: 2,
  },
}))

const ResolutionControls = observer(function ({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { classes } = useStyles()
  return (
    <Paper className={classes.controls} elevation={6}>
      <IconButton
        className={classes.button}
        onClick={() => {
          model.setResolution(model.resolution * 2)
        }}
        title="Finer resolution"
        size="small"
      >
        <AddIcon fontSize="small" />
      </IconButton>
      <IconButton
        className={classes.button}
        onClick={() => {
          model.setResolution(model.resolution / 2)
        }}
        title="Coarser resolution"
        size="small"
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
})

export default ResolutionControls
