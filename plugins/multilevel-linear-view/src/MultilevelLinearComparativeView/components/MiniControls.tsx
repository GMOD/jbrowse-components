import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Tooltip } from '@material-ui/core'
import IconButton from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import Menu from '@jbrowse/core/ui/Menu'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'

import LabelField from './LabelField'

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  return (
    <div style={{ position: 'absolute', right: '0px', zIndex: '1001' }}>
      <Paper
        style={{ background: '#aaa7', display: 'flex', alignItems: 'center' }}
      >
        {model.hideHeader ? (
          <div>
            <IconButton
              color="secondary"
              onClick={event => {
                setAnchorEl(event.currentTarget)
              }}
            >
              <ArrowDown />
            </IconButton>
            <LabelField model={model} />
          </div>
        ) : null}
        <div>
          {model.limitBpPerPx.limited &&
          bpPerPx * 2 > model.limitBpPerPx.upperLimit ? (
            <Tooltip
              title="The view is at its max zoom level relative to its neighbouring views"
              arrow
            >
              <span>
                <IconButton disabled>
                  <ZoomOut />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
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
          )}
          {model.limitBpPerPx.limited &&
          bpPerPx / 2 < model.limitBpPerPx.lowerLimit ? (
            <Tooltip
              title="The view is at its min zoom level relative to its neighbouring views"
              arrow
            >
              <span>
                <IconButton disabled>
                  <ZoomOut />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
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
          )}
        </div>
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
