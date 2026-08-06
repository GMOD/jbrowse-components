import { getFillProps } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { YSCALE_AXIS_WIDTH } from './MafYScaleGutter.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { Theme } from '@mui/material'

// Just clear of the Y-axis gutter the two bands share.
const LABEL_X = YSCALE_AXIS_WIDTH + 2
const FONT_SIZE = 9
// The on-screen label is a block with 1px of padding above it, so its text sits
// about a font-size below the band's top edge. SVG `<text>` is placed by that
// baseline directly, so the offset the CSS box implies has to be spelled out —
// otherwise the exported caption rides up out of its band.
const BASELINE_OFFSET = FONT_SIZE + 1

const useStyles = makeStyles()(theme => ({
  label: {
    position: 'absolute',
    left: LABEL_X,
    fontSize: FONT_SIZE,
    lineHeight: 1,
    padding: '1px 3px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    background: alpha(theme.palette.background.paper, 0.7),
  },
}))

/**
 * The band titles for the SVG export. Same shape as `MafYScaleGutter`'s
 * `SvgYScaleGutter`: the on-screen and exported halves of one piece of chrome,
 * side by side, so the x and the font can't be spelled two ways.
 *
 * What is titled, and when, is `model.bandLabels` — the export used to draw no
 * titles at all, which lost them from the one figure that needs them most (both
 * histograms rendered into a PNG where nothing can be hovered to disambiguate).
 */
export function SvgBandLabels({
  labels,
  theme,
}: {
  labels: { text: string; top: number }[]
  theme: Theme
}) {
  return (
    <>
      {labels.map(({ text, top }) => (
        <text
          key={text}
          x={LABEL_X}
          y={top + BASELINE_OFFSET}
          fontSize={FONT_SIZE}
          {...getFillProps(theme.palette.text.secondary)}
        >
          {text}
        </text>
      ))}
    </>
  )
}

// The on-screen half.
const MafBandLabels = observer(function MafBandLabels({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { classes } = useStyles()
  return (
    <>
      {model.bandLabels.map(({ text, top }) => (
        <div key={text} className={classes.label} style={{ top }}>
          {text}
        </div>
      ))}
    </>
  )
})

export default MafBandLabels
