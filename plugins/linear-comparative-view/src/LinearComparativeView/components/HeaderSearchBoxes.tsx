import React from 'react'
import { observer } from 'mobx-react'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
// jbrowse
import {
  LinearGenomeViewModel,
  SearchBox,
} from '@jbrowse/plugin-linear-genome-view'
import { toLocale } from '@jbrowse/core/util'

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
    <div className={classes.searchBox}>
      <SearchBox model={view} showHelp={false} />
      <Typography variant="body2" color="textSecondary" className={classes.bp}>
        {assemblyNames.join(',')} {toLocale(Math.round(coarseTotalBp))} bp
      </Typography>
    </div>
  )
})

export default HeaderSearchBoxes
