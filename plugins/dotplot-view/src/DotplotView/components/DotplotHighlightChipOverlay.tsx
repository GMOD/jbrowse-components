import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { Box, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { getHighlightColor, highlightKey } from './highlightUtils.ts'

import type { DotplotViewModel } from '../model.ts'
import type { HighlightType } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()({
  // absolute so chips sit at band anchors; auto pointer-events so clicks land
  // even though the overlay wrapper is pointer-events:none
  chip: { position: 'absolute', pointerEvents: 'auto' },
})

const HighlightChip = observer(function HighlightChip({
  model,
  highlight,
}: {
  model: DotplotViewModel
  highlight: HighlightType
}) {
  const theme = useTheme()
  const { classes } = useStyles()
  const bandColor = getHighlightColor(highlight, theme)
  const chipColor =
    bandColor.alpha() === 0 ? 'inherit' : bandColor.alpha(0.8).toRgbString()
  const h = model.getHHighlightCoords(highlight)
  const v = model.getVHighlightCoords(highlight)
  const chip = (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Dismiss highlight',
          icon: CloseIcon,
          onClick: () => {
            model.removeHighlight(highlight)
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
  )
  return (
    <>
      {h ? (
        <div className={classes.chip} style={{ left: h.left, top: 0 }}>
          {chip}
        </div>
      ) : null}
      {v ? (
        <div className={classes.chip} style={{ left: 0, top: v.top }}>
          {chip}
        </div>
      ) : null}
    </>
  )
})

const DotplotHighlightChipOverlay = observer(
  function DotplotHighlightChipOverlay({ model }: { model: DotplotViewModel }) {
    return model.highlightsVisible
      ? model.highlight.map((h, i) => (
          <HighlightChip key={highlightKey(h, i)} model={model} highlight={h} />
        ))
      : null
  },
)

export default DotplotHighlightChipOverlay
