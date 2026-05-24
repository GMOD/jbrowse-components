import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Button, alpha } from '@mui/material'

import { SPACING, WIDGET_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel
const useStyles = makeStyles()(theme => ({
  panButton: {
    background: alpha(theme.palette.background.paper, 0.8),
    height: WIDGET_HEIGHT,
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
