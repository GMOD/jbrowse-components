import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { colord } from '@jbrowse/core/util/colord'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import { Box, Tooltip, Typography, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import HighlightBand from './HighlightBand.tsx'

import type { LinearGenomeViewModel } from '../model.ts'
import type { HighlightType } from '../types.ts'

type LGV = LinearGenomeViewModel

const Highlight = observer(function Highlight({
  model,
  highlight,
}: {
  model: LGV
  highlight: HighlightType
}) {
  const theme = useTheme()
  const coords = model.getHighlightCoords(highlight)

  // user-supplied color is used as-is so explicit alpha is preserved; fall
  // back to the theme color with a standard alpha
  const bandColor = highlight.color
    ? colord(highlight.color)
    : colord(theme.palette.highlight.main).alpha(0.35)
  // hide the chip icon color when the band is fully transparent ("label-only"
  // highlight); otherwise bump the band color to 0.8 alpha so the chip is legible
  const chipAlpha = bandColor.alpha() === 0 ? 0 : 0.8

  return coords ? (
    <HighlightBand coords={coords} background={bandColor.toRgbString()}>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'Dismiss highlight',
            icon: CloseIcon,
            onClick: () => {
              model.removeHighlight(highlight)
            },
          },
          ...model.highlightMenuItems(highlight),
        ]}
      >
        <Tooltip title={highlight.label ?? 'Highlighted region'} arrow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LinkIcon
              fontSize="small"
              sx={{ color: bandColor.alpha(chipAlpha).toRgbString() }}
            />
            {highlight.label && model.labelsVisible ? (
              <Typography variant="caption" noWrap>
                {highlight.label}
              </Typography>
            ) : null}
          </Box>
        </Tooltip>
      </CascadingMenuButton>
    </HighlightBand>
  ) : null
})

export default Highlight
