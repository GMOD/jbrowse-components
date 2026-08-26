import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import LinkIcon from '@mui/icons-material/Link'
import { Box, Tooltip, Typography } from '@mui/material'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Colord } from '@jbrowse/core/util/colord'

// Interactive chip drawn inside a highlight band while the band is revealing it
// (see `useHighlightChip`): a link icon tinted to the band color plus an
// optional inline label, wrapped in a context menu. Sets its own pointer-events
// since the band is click-through. `setOpen` is how the band learns to keep the
// chip drawn while the menu is up.
export default function HighlightChip({
  color,
  label,
  tooltip,
  menuItems,
  setOpen,
}: {
  color: Colord
  label?: string
  tooltip?: string
  menuItems: MenuItem[]
  setOpen?: (arg: boolean) => void
}) {
  // hide the icon color when the band is fully transparent ("label-only"
  // highlight); otherwise bump to 0.8 alpha so the chip stays legible
  const chipAlpha = color.alpha() === 0 ? 0 : 0.8
  return (
    <Box sx={{ pointerEvents: 'auto' }}>
      <CascadingMenuButton
        data-testid="highlight-chip"
        menuItems={menuItems}
        setOpen={setOpen}
      >
        <Tooltip title={tooltip} arrow>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LinkIcon
              fontSize="small"
              sx={{ color: color.alpha(chipAlpha).toRgbString() }}
            />
            {label ? (
              <Typography variant="caption" noWrap>
                {label}
              </Typography>
            ) : null}
          </Box>
        </Tooltip>
      </CascadingMenuButton>
    </Box>
  )
}
