import CropFreeIcon from '@mui/icons-material/CropFree'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { IconButton, Tooltip, Typography } from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ColorSchemeSelect from './ColorSchemeSelect.tsx'
import GraphStats from './GraphStats.tsx'
import LinearLayoutToggle from './LinearLayoutToggle.tsx'
import SettingsMenu from './SettingsMenu.tsx'

import type { GraphGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 4px',
    borderBottom: '1px solid #ddd',
  },
})

const ZoomDisplay = observer(function ZoomDisplay({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return <Typography variant="body2">{model.zoomPercent}</Typography>
})

const GraphToolbar = observer(function GraphToolbar({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.toolbar}>
      <ColorSchemeSelect model={model} />
      <LinearLayoutToggle model={model} />
      <Tooltip title="Zoom in">
        <IconButton
          size="small"
          onClick={() => {
            model.zoom(1.5, model.width / 2, model.canvasHeight / 2)
          }}
        >
          <ZoomInIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom out">
        <IconButton
          size="small"
          onClick={() => {
            model.zoom(1 / 1.5, model.width / 2, model.canvasHeight / 2)
          }}
        >
          <ZoomOutIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom to fit">
        <IconButton
          size="small"
          onClick={() => {
            model.zoomToFit()
          }}
        >
          <CropFreeIcon />
        </IconButton>
      </Tooltip>
      <ZoomDisplay model={model} />
      <GraphStats model={model} />
      <SettingsMenu model={model} />
    </div>
  )
})

export default GraphToolbar
