import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()({
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 5,
    cursor: 'pointer',
  },
})

const HeaderRegionWidth = observer(function HeaderRegionWidth({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { coarseTotalBpDisplayStr } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {coarseTotalBpDisplayStr}
    </Typography>
  )
})

export default HeaderRegionWidth
