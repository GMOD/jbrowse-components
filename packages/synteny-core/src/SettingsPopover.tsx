import { useState } from 'react'

import TuneIcon from '@mui/icons-material/Tune'
import { IconButton, Popover, Tooltip } from '@mui/material'

import type { ReactNode } from 'react'

export default function SettingsPopover({
  title = 'Display settings',
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  return (
    <>
      <Tooltip title={title}>
        <IconButton
          onClick={e => {
            setAnchorEl(e.currentTarget)
          }}
        >
          <TuneIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div
          style={{
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            width: 280,
          }}
        >
          {children}
        </div>
      </Popover>
    </>
  )
}
