import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { syriColors, strandColors } from '../../LinearSyntenyDisplay/drawSynteny.ts'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
  },
  colorBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
  },
  label: {
    fontSize: '0.7rem',
    lineHeight: 1,
  },
}))

interface LegendItem {
  color: string
  label: string
  tooltip: string
}

const syriLegend: LegendItem[] = [
  { color: syriColors.SYN, label: 'SYN', tooltip: 'Syntenic (same chromosome, forward strand)' },
  { color: syriColors.INV, label: 'INV', tooltip: 'Inversion (same chromosome, reverse strand)' },
  { color: syriColors.TRANS, label: 'TRANS', tooltip: 'Translocation (different chromosome)' },
  { color: syriColors.DUP, label: 'DUP', tooltip: 'Duplication (non-collinear mapping within same chromosome)' },
]

const strandLegend: LegendItem[] = [
  { color: strandColors.pos, label: '+', tooltip: 'Forward strand' },
  { color: strandColors.neg, label: '-', tooltip: 'Reverse strand' },
]

const ColorLegend = observer(function ColorLegend({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()

  const firstDisplay = model.levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const colorBy = firstDisplay?.colorBy ?? 'default'

  // Only show legend for strand and syri modes
  if (colorBy !== 'strand' && colorBy !== 'syri') {
    return null
  }

  const legendItems = colorBy === 'syri' ? syriLegend : strandLegend

  return (
    <div className={classes.legend}>
      {legendItems.map(item => (
        <Tooltip key={item.label} title={item.tooltip} arrow>
          <div className={classes.legendItem}>
            <div
              className={classes.colorBox}
              style={{ backgroundColor: item.color }}
            />
            <Typography className={classes.label}>{item.label}</Typography>
          </div>
        </Tooltip>
      ))}
    </div>
  )
})

export default ColorLegend
