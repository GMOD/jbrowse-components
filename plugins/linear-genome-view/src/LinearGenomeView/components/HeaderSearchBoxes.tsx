import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SearchBox from './SearchBox.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  bp: {
    display: 'flex',
    alignItems: 'center',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
}))

// One row's locate control in a header that stacks several linear genome views:
// the compact search box, then the assembly name and the span on screen. The
// comparative view and the breakpoint split view each draw one per row, and each
// carried a character-identical copy of it — the same plugin-to-plugin import
// (`SearchBox`) both were already making, one file further down.
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
