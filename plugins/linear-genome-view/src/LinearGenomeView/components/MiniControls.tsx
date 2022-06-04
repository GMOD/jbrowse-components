import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { IconButton, Paper } from '@material-ui/core'
import { CascadingMenu as Menu } from '@jbrowse/core/ui'

//icons
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import ArrowDown from '@material-ui/icons/KeyboardArrowDown'

import { bindTrigger, usePopupState } from 'material-ui-popup-state/hooks'

import { LinearGenomeViewModel } from '..'

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()
  const popupState = usePopupState({
    popupId: 'demoMenu',
    variant: 'popover',
  })

  return (
    <>
      <Paper style={{ background: '#aaa7' }}>
        <IconButton color="secondary" {...bindTrigger(popupState)}>
          <ArrowDown />
        </IconButton>

        <IconButton
          data-testid="zoom_out"
          onClick={() => model.zoom(bpPerPx * 2)}
          disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
          color="secondary"
        >
          <ZoomOut />
        </IconButton>
        <IconButton
          data-testid="zoom_in"
          onClick={() => model.zoom(model.bpPerPx / 2)}
          disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
          color="secondary"
        >
          <ZoomIn />
        </IconButton>
      </Paper>
      <Menu
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => setAnchorEl(undefined)}
        menuItems={model.menuItems()}
        popupState={popupState}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      />
    </>
  )
})

export default MiniControls
