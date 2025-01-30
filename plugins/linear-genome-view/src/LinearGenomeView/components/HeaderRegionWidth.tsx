import { getBpDisplayStr } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()({
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 5,
    cursor: 'pointer',
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
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {getBpDisplayStr(coarseTotalBp)}
    </Typography>
  )
})

export default HeaderRegionWidth
