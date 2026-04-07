import type React from 'react'
import { Suspense, useState } from 'react'

import HelpOutlined from '@mui/icons-material/HelpOutlined'
import { IconButton } from '@mui/material'

import CascadingMenuHelpDialog from './CascadingMenuHelpDialog.tsx'

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
        style={{ marginLeft: 4, padding: 4 }}
      >
        <HelpOutlined fontSize="small" />
      </IconButton>
      {helpDialogOpen ? (
        <Suspense fallback={null}>
          <CascadingMenuHelpDialog
            helpText={helpText}
            label={label}
            onClose={event => {
              event.stopPropagation()
              setHelpDialogOpen(false)
            }}
          />{' '}
        </Suspense>
      ) : null}
    </>
  )
}
