import type React from 'react'
import { Suspense, useState } from 'react'

import HelpOutline from '@mui/icons-material/HelpOutline'
import { IconButton } from '@mui/material'

import CascadingMenuHelpDialog from './CascadingMenuHelpDialog'

export default function CascadingMenuHelpIconButton({
  helpText,
}: {
  helpText: string
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
        <HelpOutline fontSize="small" />
      </IconButton>
      {helpDialogOpen ? (
        <Suspense fallback={null}>
          <CascadingMenuHelpDialog
            helpText={helpText}
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
