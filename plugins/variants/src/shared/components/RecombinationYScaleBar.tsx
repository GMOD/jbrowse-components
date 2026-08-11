import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { YScaleBar } from '@jbrowse/wiggle-core'

import { recombinationTicks } from './recombinationAxis.ts'

// Width of the opaque gutter the axis paints over the left of the curve.
// Deliberately narrower than `AXIS_GUTTER_WIDTH_PX`, the width the alignments
// and MAF axes share: those sit above their plots, this one sits ON its plot, so
// every px of it is a px of curve hidden. 40 for as long as the axis was drawn
// by hand at fontSize 9; the shared `YScaleBar` draws at 10, and a
// four-character label ("0.00".."1.00") at that size needs ~20px, reaching back
// to x≈14 from a spine on the far edge. The rotated caption is centred on x=10
// and so occupies roughly [5, 15] — at 40 the two touched, which they already
// did a little at fontSize 9.
const Y_AXIS_WIDTH = 44

// The same rule `leftAxisSpineX` states, against this gutter's own width:
// YScaleBar crispens its spine to a local x of 0.5, so translating by
// `width - 1` lands that 1px stroke on the gutter's last pixel, and the ticks
// and numbers grow back across the gutter from there.
const SPINE_X = Y_AXIS_WIDTH - 1

const CAPTION_X = 10

/**
 * The recombination curve's y-axis, drawn over the left edge of the strip.
 *
 * The axis itself is the shared `YScaleBar`, not a local copy: this used to
 * hand-roll the spine path, the tick lines and the labels, which meant a second
 * set of answers to where the spine crispens, whether the bottom stroke stays
 * inside the box, and how a label is haloed against the plot behind it. All this
 * owns now is the gutter it paints in and the caption naming the statistic.
 */
export default function RecombinationYScaleBar({
  height,
  maxValue,
  exportSVG,
}: {
  height: number
  maxValue: number
  exportSVG?: boolean
}) {
  const palette = usePalette()
  const fg = palette.text.primary

  const content = (
    <>
      <rect
        x={0}
        y={0}
        width={Y_AXIS_WIDTH}
        height={height}
        fill={palette.background.default}
      />
      <g transform={`translate(${SPINE_X}, 0)`}>
        <YScaleBar ticks={recombinationTicks(height, maxValue)} />
      </g>
      <text
        x={CAPTION_X}
        y={height / 2}
        fontSize={10}
        fill={fg}
        textAnchor="middle"
        transform={`rotate(-90, ${CAPTION_X}, ${height / 2})`}
      >
        1 - r²
      </text>
    </>
  )

  if (exportSVG) {
    return <g>{content}</g>
  }
  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: Y_AXIS_WIDTH,
        height,
        zIndex: 1,
      }}
      width={Y_AXIS_WIDTH}
      height={height}
    >
      {content}
    </svg>
  )
}
