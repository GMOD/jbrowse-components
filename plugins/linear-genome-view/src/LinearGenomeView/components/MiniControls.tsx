import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { IconButton, Paper } from '@mui/material'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'
import Menu from '@jbrowse/core/ui/Menu'
import { LinearGenomeViewModel } from '..'

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  return (
    <Paper style={{ background: '#aaa7' }}>
      <IconButton
        color="secondary"
        onClick={event => setAnchorEl(event.currentTarget)}
      >
        <ArrowDown fontSize="small" />
      </IconButton>

      <IconButton
        data-testid="zoom_out"
        onClick={() => model.zoom(bpPerPx * 2)}
        disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
        color="secondary"
      >
        <ZoomOut fontSize="small" />
      </IconButton>
      <IconButton
        data-testid="zoom_in"
        onClick={() => model.zoom(model.bpPerPx / 2)}
        disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
        color="secondary"
      >
        <ZoomIn fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => setAnchorEl(undefined)}
        menuItems={model.menuItems()}
      />
    </Paper>
  )
})

export default MiniControls
