import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { GraphGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  stats: {
    marginLeft: 'auto',
  },
})

const GraphStats = observer(function GraphStats({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <Typography variant="body2" className={classes.stats}>
      {model.nodeCount} nodes, {model.edgeCount} edges
      {model.pathCount > 0 ? `, ${model.pathCount} paths` : ''}
    </Typography>
  )
})

export default GraphStats
