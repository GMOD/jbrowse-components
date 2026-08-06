import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Gridlines from './Gridlines.tsx'
import PaddingBlocks from './PaddingBlocks.tsx'
import ScalebarCoordinateLabels from './ScalebarCoordinateLabels.tsx'
import ScalebarRefNameLabels from './ScalebarRefNameLabels.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type React from 'react'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  // clip, not hidden: this holds a staticBlocks-width strip of labels, and a
  // scroll container here can be scrolled by the browser (focus,
  // scrollIntoView) with no scrollbar to show it, sliding the coordinates out
  // of register with the tracks. clip cannot be scrolled at all
  container: {
    overflow: 'clip',
    position: 'relative',
  },
})

interface ScalebarProps {
  model: LGV
  style?: React.CSSProperties
  className?: string
}

const Scalebar = observer(function Scalebar({
  model,
  style,
  className,
}: ScalebarProps) {
  const { classes } = useStyles()

  return (
    <Paper
      // The rubberband owns presses on the scalebar (it wraps this as its
      // ControlComponent), so the view's click-drag pan must not also start one
      // on the paths where the rubberband doesn't stopPropagation — a press with
      // the refName menu already open. See ResizeHandle for the marker contract.
      data-gesture-owner="true"
      className={cx(classes.container, className)}
      variant="outlined"
      style={style}
    >
      {/* offset 1px for left track border */}
      <Gridlines model={model} offset={1} />
      <PaddingBlocks model={model} offset={1} />
      <ScalebarCoordinateLabels model={model} />
      <ScalebarRefNameLabels model={model} />
    </Paper>
  )
})

export default Scalebar
