import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { TubeMapViewModel } from '../model.ts'

const TubeMapToolbar = observer(function TubeMapToolbar({
  model,
}: {
  model: TubeMapViewModel
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderBottom: '1px solid #ddd',
        background: '#fafafa',
      }}
    >
      <Typography variant="body2">
        {model.nodeCount} nodes, {model.trackCount} tracks
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          model.zoomToFit(500)
        }}
      >
        Zoom to fit
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          model.zoom(1.3, model.width / 2, 250)
        }}
      >
        +
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          model.zoom(0.7, model.width / 2, 250)
        }}
      >
        -
      </Button>
      <div style={{ flex: 1 }} />
      <Button
        size="small"
        onClick={() => {
          model.clearGraph()
        }}
      >
        Clear
      </Button>
    </div>
  )
})

export default TubeMapToolbar
