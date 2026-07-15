import { useState } from 'react'
import type { ReactNode } from 'react'

import TuneIcon from '@mui/icons-material/Tune'
import { IconButton, Popover, Tooltip } from '@mui/material'

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
        {children}
      </Popover>
    </>
  )
}
