import { lazy } from 'react'

import { getBpDisplayStr, getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'

const RegionWidthEditorDialog = lazy(() => import('./RegionWidthEditorDialog'))

const useStyles = makeStyles()({
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 5,
    cursor: 'pointer',
    minWidth: 50,
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
  },
})

const HeaderRegionWidth = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography
      variant="body2"
      color="textSecondary"
      className={classes.bp}
      onClick={() => {
        getSession(model).queueDialog(handleClose => [
          RegionWidthEditorDialog,
          {
            model,
            handleClose,
          },
        ])
      }}
    >
      {getBpDisplayStr(coarseTotalBp)}
    </Typography>
  )
})

export default HeaderRegionWidth
