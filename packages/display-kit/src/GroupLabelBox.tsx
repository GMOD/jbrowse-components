import { Fragment } from 'react'

import { measureText } from '@jbrowse/core/util'

import {
  GROUP_LABEL_BG_OPACITY,
  GROUP_LABEL_BORDER_WIDTH,
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_FONT_WEIGHT,
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_INSET_X,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
  groupChipTop,
  groupSectionLabel,
  sectionKey,
} from './groupLabelStyle.ts'

import type { GroupChipSection } from './GroupLabelChips.tsx'
import type { Theme } from '@mui/material'

const SEMIBOLD_WIDTH_FACTOR = 1.1

// The on-screen chip without its buttons, which are interactive-only. A box
// behind the text keeps the label legible over a busy background.
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
  const height = GROUP_LABEL_HEIGHT
  const width =
    measureText(text, fontSize) * SEMIBOLD_WIDTH_FACTOR + paddingX * 2
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
        stroke={theme.palette.text.disabled}
        strokeWidth={GROUP_LABEL_BORDER_WIDTH}
      />
      <text
        x={x + paddingX}
        y={y + height - 4}
        fontSize={fontSize}
        fontWeight={GROUP_LABEL_FONT_WEIGHT}
        fill={theme.palette.text.primary}
      >
        {text}
      </text>
    </g>
  )
}

/**
 * The export's twin of `GroupLabelChips`: a name box per section and a rule
 * at each section's top after the first, placed by the same `groupChipTop`.
 * Rendered last, so a group's name sits over what it labels. Without the rule
 * an exported stack ran together, the chip being the only other mark of where
 * one group ends.
 */
export function GroupLabelBoxes({
  sections,
  left,
  width,
  canvasHeight,
  theme,
}: {
  sections: readonly Pick<
    GroupChipSection,
    'key' | 'label' | 'top' | 'height'
  >[]
  left: number
  width: number
  canvasHeight: number
  theme: Theme
}) {
  return (
    <>
      {sections.map((section, i) => {
        const chipTop = groupChipTop(section.top, section.height, canvasHeight)
        return (
          <Fragment key={sectionKey(section.key)}>
            {i > 0 ? (
              <line
                x1={0}
                x2={width}
                y1={section.top}
                y2={section.top}
                stroke={theme.palette.divider}
                strokeWidth={1}
              />
            ) : null}
            {chipTop === undefined ? null : (
              <GroupLabelBox
                x={left + GROUP_LABEL_INSET_X}
                y={chipTop + 1}
                text={groupSectionLabel(section.label)}
                theme={theme}
              />
            )}
          </Fragment>
        )
      })}
    </>
  )
}
