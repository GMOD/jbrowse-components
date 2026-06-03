import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  bp: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
  },
}))

const HeaderRegionWidth = observer(function HeaderRegionWidth({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <Typography variant="body2" className={classes.bp}>
      {model.effectiveTotalBpDisplayStr}
    </Typography>
  )
})

export default HeaderRegionWidth
