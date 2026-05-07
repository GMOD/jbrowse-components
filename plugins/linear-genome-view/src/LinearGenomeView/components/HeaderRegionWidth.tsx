import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

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
  return (
    <Typography variant="body2" color="text.secondary" className={classes.bp}>
      {model.coarseTotalBpDisplayStr}
    </Typography>
  )
})

export default HeaderRegionWidth
