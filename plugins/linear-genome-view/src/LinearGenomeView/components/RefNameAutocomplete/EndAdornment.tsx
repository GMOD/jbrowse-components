import { Suspense, lazy, useState } from 'react'

import HelpIcon from '@mui/icons-material/Help'
import SearchIcon from '@mui/icons-material/Search'
import { IconButton, InputAdornment } from '@mui/material'

// lazy
const HelpDialog = lazy(() => import('./HelpDialog.tsx'))

function HelpAdornment() {
  const [isHelpDialogDisplayed, setHelpDialogDisplayed] = useState(false)
  return (
    <>
      <IconButton
        onClick={() => {
          setHelpDialogDisplayed(true)
        }}
        size="small"
      >
        <HelpIcon fontSize="small" />
      </IconButton>
      {isHelpDialogDisplayed ? (
        <Suspense fallback={null}>
          <HelpDialog
            handleClose={() => {
              setHelpDialogDisplayed(false)
            }}
          />
        </Suspense>
      ) : null}
    </>
  )
}

export default function EndAdornment({ showHelp }: { showHelp?: boolean }) {
  return (
    <>
      <InputAdornment position="end" style={{ marginRight: 7 }}>
        <SearchIcon fontSize="small" />
        {showHelp ? <HelpAdornment /> : null}
      </InputAdornment>
    </>
  )
}
