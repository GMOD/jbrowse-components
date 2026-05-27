import React from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

const useStyles = makeStyles()({
  handle: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    zIndex: 10,
    background: 'transparent',
    '&:hover': {
      background: 'rgba(0,0,0,0.1)',
    },
  },
})

/**
 * Thin row-resize strip at the bottom of the coverage band. Drives
 * `setCoverageHeight` via the shared `ResizeHandle` from `@jbrowse/core/ui`
 * (no per-plugin drag plumbing).
 */
const MafCoverageResizeHandle = observer(function MafCoverageResizeHandle({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { classes } = useStyles()
  const { showCoverage, coverageHeight } = model
  return showCoverage ? (
    <ResizeHandle
      onDrag={n => {
        model.setCoverageHeight(Math.max(20, coverageHeight + n))
        return undefined
      }}
      style={{ top: coverageHeight - 4 }}
      className={classes.handle}
    />
  ) : null
})

export default MafCoverageResizeHandle
