import React from 'react'
import { observer } from 'mobx-react'
import { Button, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import RefreshIcon from '@mui/icons-material/Refresh'

const useStyles = makeStyles()({
  blockError: {
    width: '30em',
    whiteSpace: 'normal',
  },
})

function BlockError({ error, reload }: { error: unknown; reload: () => void }) {
  // reload function gets passed here
  const { classes } = useStyles()
  return (
    <div className={classes.blockError}>
      {reload ? (
        <Button
          onClick={reload}
          // variant="outlined"
          startIcon={<RefreshIcon />}
        >
          Reload
        </Button>
      ) : null}
      <Typography color="error" variant="body2">
        {`${error}`}
      </Typography>
    </div>
  )
}

export default observer(BlockError)
