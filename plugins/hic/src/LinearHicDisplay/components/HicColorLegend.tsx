import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { getLegendCssGradient } from './colorRamp.ts'
import { getNiceScale } from './niceScale.ts'

const useStyles = makeStyles()({
  legend: {
    position: 'absolute',
    right: 10,
    top: 10,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: 8,
    fontSize: 11,
    pointerEvents: 'none',
    zIndex: 100,
  },
  gradientBar: {
    width: 100,
    height: 12,
    marginBottom: 4,
    borderRadius: 2,
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
  },
})

const HicColorLegend = observer(function HicColorLegend({
  maxScore,
  colorScheme = 'juicebox',
  useLogScale,
}: {
  maxScore: number
  colorScheme?: string
  useLogScale?: boolean
}) {
  const { classes } = useStyles()
  const gradient = getLegendCssGradient(colorScheme)
  const { min, max } = getNiceScale(maxScore, useLogScale)

  return (
    <div className={classes.legend}>
      <div className={classes.gradientBar} style={{ background: gradient }} />
      <div className={classes.labels}>
        <span>{min !== undefined ? toLocale(min) : ''}</span>
        <span>
          {max !== undefined ? toLocale(max) : ''}
          {useLogScale ? ' (log)' : ''}
        </span>
      </div>
    </div>
  )
})

export default HicColorLegend
