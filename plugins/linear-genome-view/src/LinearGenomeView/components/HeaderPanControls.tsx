import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Button, alpha } from '@mui/material'

import { SPACING } from '../consts'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel
const useStyles = makeStyles()(theme => ({
  panButton: {
    background: alpha(theme.palette.background.paper, 0.8),
    color: theme.palette.text.primary,
    margin: SPACING,
  },
}))

export default function HeaderPanControls({ model }: { model: LGV }) {
  const { classes } = useStyles()
  return (
    <>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => {
          model.slide(-0.9)
        }}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => {
          model.slide(0.9)
        }}
      >
        <ArrowForwardIcon />
      </Button>
    </>
  )
}
