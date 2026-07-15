import type { ReactNode } from 'react'

import HelpIcon from '@mui/icons-material/Help'
import { Tooltip, Typography } from '@mui/material'

// Label-on-left row used inside synteny/dotplot settings popovers. Optional
// help tooltip renders an inline help icon next to the label.
export default function SettingRow({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Typography
        variant="body2"
        style={{ whiteSpace: 'nowrap', minWidth: 80 }}
      >
        {label}
        {help ? (
          <Tooltip title={help} arrow>
            <HelpIcon sx={{ fontSize: '0.875rem', ml: 0.5 }} />
          </Tooltip>
        ) : null}
      </Typography>
      {children}
    </div>
  )
}
