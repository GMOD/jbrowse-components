import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { IconButton, Paper } from '@mui/material'
import Menu from '@jbrowse/core/ui/Menu'

// icons
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'

// locals
import { LinearGenomeViewModel } from '..'

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor, hideHeader } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  return hideHeader ? (
    <div style={{ position: 'absolute', right: '0px', zIndex: '1001' }}>
      <Paper style={{ background: '#aaa7' }}>
        <IconButton onClick={event => setAnchorEl(event.currentTarget)}>
          <ArrowDown fontSize="small" />
        </IconButton>

        <IconButton
          data-testid="zoom_out"
          onClick={() => model.zoom(bpPerPx * 2)}
          disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
        >
          <ZoomOut fontSize="small" />
        </IconButton>
        <IconButton
          data-testid="zoom_in"
          onClick={() => model.zoom(model.bpPerPx / 2)}
          disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
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
    </div>
  ) : null
})

export default MiniControls
