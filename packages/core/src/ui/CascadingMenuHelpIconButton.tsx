import { useState } from 'react'

import HelpOutlined from '@mui/icons-material/HelpOutlined'
import { IconButton } from '@mui/material'

import CascadingMenuHelpDialog from './CascadingMenuHelpDialog.tsx'

import type React from 'react'

const buttonStyle = { marginLeft: 4, padding: 4 }

// Invisible button that reserves the exact same footprint as the help icon, so
// rows without help text keep their end decoration (radio/checkbox) aligned
// with rows that have one
export function CascadingMenuHelpIconSpacer() {
  return (
    <IconButton
      size="small"
      disabled
      style={{ ...buttonStyle, visibility: 'hidden' }}
    >
      <HelpOutlined fontSize="small" />
    </IconButton>
  )
}

export default function CascadingMenuHelpIconButton({
  helpText,
  label,
}: {
  helpText: string
  label?: React.ReactNode
}) {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  return (
    <>
      <IconButton
        size="small"
        onClick={event => {
          event.stopPropagation()
          setHelpDialogOpen(true)
        }}
        style={buttonStyle}
      >
        <HelpOutlined fontSize="small" />
      </IconButton>
      {helpDialogOpen ? (
        <CascadingMenuHelpDialog
          helpText={helpText}
          label={label}
          onClose={event => {
            event.stopPropagation()
            setHelpDialogOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
