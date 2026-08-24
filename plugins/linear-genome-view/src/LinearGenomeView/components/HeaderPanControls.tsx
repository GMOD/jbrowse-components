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
  // the arrows are the whole button, so MUI's 64px text-button minimum and the
  // gap either side of it are pure air — the pair gives up 80px of it when the
  // header can't hold everything
  compact: {
    margin: 1,
    minWidth: 0,
    padding: theme.spacing(0, 0.5),
  },
}))

export default function HeaderPanControls({
  model,
  compact,
}: {
  model: LGV
  compact?: boolean
}) {
  const { classes, cx } = useStyles()
  const className = cx(classes.panButton, compact && classes.compact)
  return (
    <>
      <Button
        variant="outlined"
        aria-label="Pan left"
        className={className}
        onClick={() => {
          model.slide(-0.9)
        }}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        variant="outlined"
        aria-label="Pan right"
        className={className}
        onClick={() => {
          model.slide(0.9)
        }}
      >
        <ArrowForwardIcon />
      </Button>
    </>
  )
}
