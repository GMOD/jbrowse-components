import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  bp: {
    display: 'flex',
    alignItems: 'center',
    // reserve a fixed width so the varying-length bp string (e.g. 19.5Mbp vs
    // 950Kbp) does not shift the adjacent zoom controls as the user zooms/pans
    minWidth: 50,
    // equal-width digits so the number does not reflow as it changes
    fontVariantNumeric: 'tabular-nums',
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
