import { measureText } from '@jbrowse/core/util'

import {
  GROUP_LABEL_BG_OPACITY,
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
} from '../groupLabelStyle.ts'

import type { Theme } from '@mui/material'

// Static equivalent of the on-screen GroupLabelsOverlay chip (no
// collapse/expand affordances — those are interactive-only). A background box
// behind the text, not bare text, so the label stays legible over a busy
// pileup/coverage background.
export default function GroupLabelBox({
  x,
  y,
  text,
  theme,
}: {
  x: number
  y: number
  text: string
  theme: Theme
}) {
  const fontSize = GROUP_LABEL_FONT_SIZE
  const paddingX = GROUP_LABEL_PADDING_X
  const height = 16
  const width = measureText(text, fontSize) + paddingX * 2
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={GROUP_LABEL_RADIUS}
        fill={theme.palette.background.paper}
        fillOpacity={GROUP_LABEL_BG_OPACITY}
      />
      <text
        x={x + paddingX}
        y={y + height - 4}
        fontSize={fontSize}
        fill={theme.palette.text.secondary}
      >
        {text}
      </text>
    </g>
  )
}
