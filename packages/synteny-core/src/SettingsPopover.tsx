import { useState } from 'react'

import TuneIcon from '@mui/icons-material/Tune'
import { IconButton, Popover } from '@mui/material'

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
      <IconButton
        onClick={e => {
          setAnchorEl(e.currentTarget)
        }}
        title={title}
      >
        <TuneIcon />
      </IconButton>
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
