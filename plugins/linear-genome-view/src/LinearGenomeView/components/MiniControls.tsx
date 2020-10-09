import React, { useState } from 'react'
import { observer } from 'mobx-react'
import IconButton from '@material-ui/core/IconButton'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import Paper from '@material-ui/core/Paper'
import Menu from '@jbrowse/core/ui/Menu'
import { LinearGenomeViewModel } from '..'

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  return (
    <>
      <Paper style={{ background: '#aaa7' }}>
        <IconButton
          color="secondary"
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
        >
          <ArrowDown />
        </IconButton>

        <IconButton
          data-testid="zoom_out"
          onClick={() => {
            model.zoom(bpPerPx * 2)
          }}
          disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
          color="secondary"
        >
          <ZoomOut />
        </IconButton>
        <IconButton
          data-testid="zoom_in"
          onClick={() => {
            model.zoom(model.bpPerPx / 2)
          }}
          disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
          color="secondary"
        >
          <ZoomIn />
        </IconButton>
      </Paper>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => {
          setAnchorEl(undefined)
        }}
        menuItems={model.menuItems}
      />
    </>
  )
})

export default MiniControls
