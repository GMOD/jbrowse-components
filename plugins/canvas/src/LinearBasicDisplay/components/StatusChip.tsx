import { Chip, Tooltip } from '@mui/material'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { MouseEvent, ReactElement } from 'react'

// The chip floats over the rendered canvas, so it needs an opaque background —
// features showing through the label made it hard to read.
const useStyles = makeStyles()(theme => ({
  chip: {
    background: theme.palette.background.paper,
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
}))

// Shared look for every bottom-right status "blurb" (feature-count, isoform
// collapse, ...). One outlined MUI Chip so the indicators read as a single
// consistent system rather than a grab-bag of differently-styled widgets. An
// optional onClick makes the chip an action; an optional onDelete adds the (×).
export default function StatusChip({
  icon,
  label,
  tooltip,
  onClick,
  onDelete,
}: {
  icon: ReactElement
  label: string
  tooltip: string
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onDelete?: () => void
}) {
  const { classes } = useStyles()
  return (
    <Tooltip title={tooltip}>
      <Chip
        size="small"
        variant="outlined"
        className={classes.chip}
        icon={icon}
        label={label}
        onClick={
          onClick
            ? event => {
                onClick(event)
              }
            : undefined
        }
        onDelete={
          onDelete
            ? () => {
                onDelete()
              }
            : undefined
        }
      />
    </Tooltip>
  )
}
