import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'

import { makeStyles, Typography } from '@material-ui/core'

import { GridBookmarkModel } from '../model'

const useStyles = makeStyles(theme => ({
  container: {
    margin: 12,
  },
}))

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <Typography>Grid bookmark widget</Typography>
    </div>
  )
}

export default observer(GridBookmarkWidget)
