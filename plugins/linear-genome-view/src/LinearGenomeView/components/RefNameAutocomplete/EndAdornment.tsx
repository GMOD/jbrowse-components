import { Suspense, lazy, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import SearchIcon from '@mui/icons-material/Search'
import { IconButton, InputAdornment } from '@mui/material'

// lazy
const HelpDialog = lazy(() => import('./HelpDialog'))

const useStyles = makeStyles()(() => ({
  th: {
    marginRight: 7,
  },
}))

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
  const { classes } = useStyles()
  return (
    <>
      <InputAdornment position="end" className={classes.th}>
        <SearchIcon fontSize="small" />
        {showHelp ? <HelpAdornment /> : null}
      </InputAdornment>
    </>
  )
}
