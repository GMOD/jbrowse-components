import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { Box, Tooltip, Typography } from '@mui/material'

import type { SvgIconComponent } from '@mui/icons-material'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Colord } from '@jbrowse/core/util/colord'

// Shared chip drawn inside a highlight band: an icon tinted to the band color
// plus an optional inline label, wrapped in a context menu. Used by both the
// LGV view.highlight chip and the grid-bookmark bookmark chip.
export default function HighlightChip({
  icon: Icon,
  color,
  label,
  labelsVisible,
  tooltip,
  menuItems,
}: {
  icon: SvgIconComponent
  color: Colord
  label?: string
  labelsVisible?: boolean
  tooltip?: string
  menuItems: MenuItem[]
}) {
  // hide the icon color when the band is fully transparent ("label-only"
  // highlight); otherwise bump to 0.8 alpha so the chip stays legible
  const chipAlpha = color.alpha() === 0 ? 0 : 0.8
  return (
    <CascadingMenuButton menuItems={menuItems}>
      <Tooltip title={tooltip} arrow>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Icon
            fontSize="small"
            sx={{ color: color.alpha(chipAlpha).toRgbString() }}
          />
          {label && labelsVisible ? (
            <Typography variant="caption" noWrap>
              {label}
            </Typography>
          ) : null}
        </Box>
      </Tooltip>
    </CascadingMenuButton>
  )
}
