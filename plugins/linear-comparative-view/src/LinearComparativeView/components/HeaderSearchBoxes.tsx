import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(() => ({
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  searchBox: {
    display: 'flex',
  },
}))

const HeaderSearchBoxes = observer(function ({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { assemblyDisplayNames, coarseTotalBp } = view
  return (
    <span className={classes.searchBox}>
      <SearchBox model={view} showHelp={false} />
      <Typography variant="body2" color="textSecondary" className={classes.bp}>
        {assemblyDisplayNames.join(',')} {getBpDisplayStr(coarseTotalBp)}
      </Typography>
    </span>
  )
})

export default HeaderSearchBoxes
