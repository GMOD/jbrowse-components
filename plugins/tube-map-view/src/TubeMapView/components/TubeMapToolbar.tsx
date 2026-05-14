import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { CANVAS_HEIGHT } from '../model.ts'

import type { TubeMapViewModel } from '../model.ts'

const useStyles = makeStyles()({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderBottom: '1px solid #ddd',
    background: '#fafafa',
  },
  graphName: { fontWeight: 500 },
  spacer: { flex: 1 },
})

const TubeMapToolbar = observer(function TubeMapToolbar({
  model,
}: {
  model: TubeMapViewModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.toolbar}>
      {model.graphName ? (
        <Typography variant="body2" className={classes.graphName}>
          {model.graphName}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
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
      <div className={classes.spacer} />
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
