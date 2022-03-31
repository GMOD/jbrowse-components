import React, { useState } from 'react'
import { observer } from 'mobx-react'
import IconButton from '@material-ui/core/IconButton'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'
import Paper from '@material-ui/core/Paper'
import Menu from '@jbrowse/core/ui/Menu'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'
import { Typography } from '@material-ui/core'

const MiniControls = observer(
  (props: { model: LinearGenomeViewModel; viewName?: string }) => {
    const { model, viewName } = props
    const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model
    const [anchorEl, setAnchorEl] = useState<HTMLElement>()

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

          <Typography style={{ paddingRight: '5px' }}>{viewName}</Typography>
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
  },
)

export default MiniControls
