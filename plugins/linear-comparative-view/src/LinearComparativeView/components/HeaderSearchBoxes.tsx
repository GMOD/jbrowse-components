import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  bp: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
}))

const HeaderSearchBoxes = observer(function HeaderSearchBoxes({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { assemblyDisplayNames, coarseTotalBp } = view
  return (
    <span className={classes.searchBox}>
      <SearchBox
        model={view}
        showHelp={false}
        maxWidth={250}
        minWidth={100}
        style={{ margin: 0 }}
      />
      <Typography variant="body2" color="text.secondary" className={classes.bp}>
        {assemblyDisplayNames.join(',')} {getBpDisplayStr(coarseTotalBp)}
      </Typography>
    </span>
  )
})

export default HeaderSearchBoxes
