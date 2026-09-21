import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { highlightKey } from '@jbrowse/core/util/highlights'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { Box, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { getHighlightColor } from './highlightUtils.ts'

import type { DotplotViewModel } from '../model.ts'
import type { HighlightType } from '@jbrowse/core/util/highlights'

const useStyles = makeStyles()({
  // absolute so chips sit at band anchors; auto pointer-events so clicks land
  // even though the overlay wrapper is pointer-events:none
  chip: { position: 'absolute', pointerEvents: 'auto' },
})

// One band's chip, anchored at the band's edge of the plot: the x-axis band's
// at the top of its column, the y-axis band's at the left of its row.
const HighlightChip = observer(function HighlightChip({
  model,
  highlight,
  position,
}: {
  model: DotplotViewModel
  highlight: HighlightType
  position: { left: number; top: number }
}) {
  const theme = useTheme()
  const { classes } = useStyles()
  const bandColor = getHighlightColor(highlight, theme)
  const chipColor =
    bandColor.alpha() === 0 ? 'inherit' : bandColor.alpha(0.8).toRgbString()

  // The plot starts a drag on pointerdown and takes POINTER CAPTURE for it, and
  // a captured pointer drags the compatibility mouse events with it — so
  // `click` is delivered to the plot rather than to the chip's button, and the
  // menu silently never opened. Stopping the pointerdown means a press that
  // starts on a chip never captures, the same fix `JBrowseTabMenu` carries.
  return (
    <div
      className={classes.chip}
      style={position}
      onPointerDown={event => {
        event.stopPropagation()
      }}
    >
      <CascadingMenuButton
        data-testid="highlight-chip"
        menuItems={[
          {
            label: 'Dismiss highlight',
            icon: CloseIcon,
            onClick: () => {
              getSession(model).removeHighlight(highlight)
            },
          },
        ]}
      >
        <Tooltip title={highlight.label ?? 'Highlighted region'} arrow>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LinkIcon fontSize="small" sx={{ color: chipColor }} />
          </Box>
        </Tooltip>
      </CascadingMenuButton>
    </div>
  )
})

const HighlightChips = observer(function HighlightChips({
  model,
  highlight,
}: {
  model: DotplotViewModel
  highlight: HighlightType
}) {
  const h = model.getHHighlightCoords(highlight)
  const v = model.getVHighlightCoords(highlight)
  return (
    <>
      {h ? (
        <HighlightChip
          model={model}
          highlight={highlight}
          position={{ left: h.left, top: 0 }}
        />
      ) : null}
      {v ? (
        <HighlightChip
          model={model}
          highlight={highlight}
          position={{ left: 0, top: v.top }}
        />
      ) : null}
    </>
  )
})

const DotplotHighlightChipOverlay = observer(
  function DotplotHighlightChipOverlay({ model }: { model: DotplotViewModel }) {
    return getSession(model).highlightsVisible
      ? model.highlights.map((h, i) => (
          <HighlightChips
            key={highlightKey(h, i)}
            model={model}
            highlight={h}
          />
        ))
      : null
  },
)

export default DotplotHighlightChipOverlay
