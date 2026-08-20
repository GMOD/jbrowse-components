import { useState } from 'react'

import TuneIcon from '@mui/icons-material/Tune'
import { IconButton, Popover, Tooltip } from '@mui/material'

import type { CSSProperties, ReactNode } from 'react'

/**
 * `width`/`labelWidth` reach the rows as CSS custom properties rather than as
 * props: every `SettingRow` in a panel has to share one label column or the
 * controls stop lining up, and threading that through each row is a rule the
 * next row added would break silently.
 */
export default function SettingsPopover({
  title = 'Display settings',
  width = 280,
  labelWidth = 96,
  children,
}: {
  title?: string
  width?: number
  labelWidth?: number
  children: ReactNode
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const panelStyle: CSSProperties & Record<string, string | number> = {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width,
    '--setting-label-width': `${labelWidth}px`,
  }
  return (
    <>
      <Tooltip title={title}>
        <IconButton
          aria-label={title}
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
        <div style={panelStyle}>{children}</div>
      </Popover>
    </>
  )
}
