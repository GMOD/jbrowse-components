import { observer } from 'mobx-react'
import { Typography, Tooltip, IconButton } from '@mui/material'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import CropFreeIcon from '@mui/icons-material/CropFree'

import ColorSchemeSelect from './ColorSchemeSelect.tsx'
import LinearLayoutToggle from './LinearLayoutToggle.tsx'
import GraphStats from './GraphStats.tsx'
import SettingsMenu from './SettingsMenu.tsx'

import type { GraphGenomeViewModel } from '../model.ts'

const ZoomDisplay = observer(function ZoomDisplay({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return <Typography variant="body2">{model.zoomPercent}</Typography>
})

const GraphToolbar = observer(function GraphToolbar({
  model,
  canvasHeight,
}: {
  model: GraphGenomeViewModel
  canvasHeight: number
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 4px',
        borderBottom: '1px solid #ddd',
      }}
    >
      <ColorSchemeSelect model={model} />
      <LinearLayoutToggle model={model} />
      <Tooltip title="Zoom in">
        <IconButton
          size="small"
          onClick={() => model.zoom(1.5, model.width / 2, canvasHeight / 2)}
        >
          <ZoomInIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom out">
        <IconButton
          size="small"
          onClick={() => model.zoom(1 / 1.5, model.width / 2, canvasHeight / 2)}
        >
          <ZoomOutIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Zoom to fit">
        <IconButton size="small" onClick={() => model.zoomToFit(canvasHeight)}>
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
