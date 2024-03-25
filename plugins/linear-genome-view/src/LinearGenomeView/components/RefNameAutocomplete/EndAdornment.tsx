import React, { Suspense, lazy, useState } from 'react'

import { IconButton, InputAdornment } from '@mui/material'

// icons
import SearchIcon from '@mui/icons-material/Search'
import HelpIcon from '@mui/icons-material/Help'

// lazy
const HelpDialog = lazy(() => import('./HelpDialog'))

function HelpAdornment() {
  const [isHelpDialogDisplayed, setHelpDialogDisplayed] = useState(false)
  return (
    <>
      <IconButton onClick={() => setHelpDialogDisplayed(true)} size="small">
        <HelpIcon fontSize="small" />
      </IconButton>
      {isHelpDialogDisplayed ? (
        <Suspense fallback={null}>
          <HelpDialog handleClose={() => setHelpDialogDisplayed(false)} />
        </Suspense>
      ) : null}
    </>
  )
}

export default function EndAdornment({
  showHelp,
  endAdornment,
}: {
  showHelp?: boolean
  endAdornment: React.ReactNode
}) {
  return (
    <>
      <InputAdornment position="end" style={{ marginRight: 7 }}>
        <SearchIcon fontSize="small" />
        {showHelp ? <HelpAdornment /> : null}
      </InputAdornment>
      {endAdornment}
    </>
  )
}
