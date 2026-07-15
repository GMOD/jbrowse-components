import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ZoomTransform from './ZoomTransform.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  absoluteFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  minorLine: {
    stroke: theme.palette.gridlineMinor,
  },
  majorLine: {
    stroke: theme.palette.gridlineMajor,
  },
}))

// Background gridline ticks; render UNDER track content. Tick marks collapse
// into two <path>s (minor + major) rather than one div each: zoom rebuilds two
// `d` strings and patches two attributes instead of reconciling ~150 nodes per
// frame. Vector stays crisp at any DPR with no canvas pixel-buffer size cap;
// +0.5 centers the 1px stroke on a pixel column to match the old divs; lines
// run to y=100000 and are clipped by the svg box, so we never measure height.
const Gridlines = observer(function Gridlines({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const { gridlineTicks } = model

  let minorD = ''
  let majorD = ''
  for (const { x, major } of gridlineTicks) {
    const seg = `M${x + 0.5} 0V100000`
    if (major) {
      majorD += seg
    } else {
      minorD += seg
    }
  }

  return (
    <ZoomTransform model={model} offset={offset}>
      <svg className={classes.absoluteFill}>
        <path d={minorD} className={classes.minorLine} strokeWidth={1} />
        <path d={majorD} className={classes.majorLine} strokeWidth={1} />
      </svg>
    </ZoomTransform>
  )
})

export default Gridlines
