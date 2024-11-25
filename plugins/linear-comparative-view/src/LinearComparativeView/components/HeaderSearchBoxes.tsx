import React from 'react'
import { toLocale } from '@jbrowse/core/util'
import { SearchBox } from '@jbrowse/plugin-linear-genome-view'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
// jbrowse
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
  const { assemblyNames, coarseTotalBp } = view
  return (
    <span className={classes.searchBox}>
      <SearchBox model={view} showHelp={false} />
      <Typography variant="body2" color="textSecondary" className={classes.bp}>
        {assemblyNames.join(',')} {toLocale(Math.round(coarseTotalBp))} bp
      </Typography>
    </span>
  )
})

export default HeaderSearchBoxes
