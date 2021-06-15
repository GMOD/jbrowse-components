import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'

import { Typography } from '@material-ui/core'

import { GridBookmarkModel } from '../model'

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  return (
    <div>
      <Typography>Grid bookmark widget</Typography>
    </div>
  )
}

export default observer(GridBookmarkWidget)
