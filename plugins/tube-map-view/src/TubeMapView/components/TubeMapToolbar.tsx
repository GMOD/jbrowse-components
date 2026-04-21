import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { CANVAS_HEIGHT } from '../model.ts'

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
      {model.graphName ? (
        <Typography variant="body2" style={{ fontWeight: 500 }}>
          {model.graphName}
        </Typography>
      ) : null}
      <Typography variant="body2" color="textSecondary">
        {model.nodeCount} nodes, {model.trackCount} tracks
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          model.zoomToFit(CANVAS_HEIGHT)
        }}
      >
        Zoom to fit
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          model.zoom(1.3, model.width / 2, CANVAS_HEIGHT / 2)
        }}
      >
        +
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          model.zoom(0.7, model.width / 2, CANVAS_HEIGHT / 2)
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
