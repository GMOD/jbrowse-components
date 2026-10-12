import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getFillProps } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { AXIS_GUTTER_WIDTH_PX } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

// Just clear of the Y-axis gutter the two bands share.
const LABEL_X = AXIS_GUTTER_WIDTH_PX + 2
const FONT_SIZE = 9
// SVG `<text>` is placed by baseline, so spell out the offset the on-screen
// label's CSS box implies (1px padding plus a font-size).
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
 * The band titles for the SVG export, beside their on-screen half so the x and
 * the font are spelled once. `model.bandLabels` decides what is titled.
 */
export function SvgMafBandLabels({
  labels,
}: {
  labels: { text: string; top: number }[]
}) {
  const palette = usePalette()
  return (
    <>
      {labels.map(({ text, top }) => (
        <text
          key={text}
          x={LABEL_X}
          y={top + BASELINE_OFFSET}
          fontSize={FONT_SIZE}
          {...getFillProps(palette.text.secondary)}
        >
          {text}
        </text>
      ))}
    </>
  )
}

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
