import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { GraphGenomeViewModel } from '../model.ts'

const GraphStats = observer(function GraphStats({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return (
    <Typography variant="body2" style={{ marginLeft: 'auto' }}>
      {model.nodeCount} nodes, {model.edgeCount} edges
      {model.pathCount > 0 ? `, ${model.pathCount} paths` : ''}
    </Typography>
  )
})

export default GraphStats
