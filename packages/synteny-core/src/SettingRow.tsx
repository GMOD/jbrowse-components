import { Typography } from '@mui/material'

import HelpTooltip from './HelpTooltip.tsx'

import type { ReactNode } from 'react'

// One row of a synteny/dotplot settings popover. Shares a fixed 3-column grid
// (label | control | help) with every other row so controls all start at the
// same x and help icons line up in a consistent trailing column.
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto',
        alignItems: 'center',
        columnGap: 8,
        minHeight: 28,
      }}
    >
      <Typography variant="body2" style={{ whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <div style={{ display: 'flex', minWidth: 0 }}>{children}</div>
      <HelpTooltip help={help} />
    </div>
  )
}
