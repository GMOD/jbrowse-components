import React, { useState } from 'react'
import { observer } from 'mobx-react'
import IconButton from '@material-ui/core/IconButton'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import Paper from '@material-ui/core/Paper'
import Menu from '@jbrowse/core/ui/Menu'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'
import { styled, TextField, Typography } from '@material-ui/core'
import { measureText } from '@jbrowse/core/util'

const MAX_WIDTH = 450
const MIN_WIDTH = 50

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  const determineWidth = () => {
    const width =
      measureText(model.displayName, 15) < MAX_WIDTH
        ? measureText(model.displayName, 15) > MIN_WIDTH
          ? measureText(model.displayName, 15)
          : MIN_WIDTH
        : MAX_WIDTH
    return width
  }

  const [inputWidth, setInputWidth] = useState<number>(determineWidth())

  const setViewLabelX = (label: any) => {
    model.setDisplayName(label)
    setInputWidth(determineWidth())
  }

  return (
    <div style={{ position: 'absolute', right: '0px', zIndex: '1001' }}>
      <Paper
        style={{ background: '#aaa7', display: 'flex', alignItems: 'center' }}
      >
        <IconButton
          color="secondary"
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
        >
          <ArrowDown />
        </IconButton>
        <TextField
          variant="standard"
          value={model.displayName}
          size="small"
          style={{ margin: '0px', paddingRight: '5px' }}
          onChange={(event: any) => setViewLabelX(event?.target.value)}
          InputProps={{
            style: { width: `${inputWidth}px` },
          }}
        />
        {model.hideHeader ? (
          <div>
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
          </div>
        ) : null}
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
        menuItems={model.menuItems()}
      />
    </div>
  )
})

export default MiniControls
