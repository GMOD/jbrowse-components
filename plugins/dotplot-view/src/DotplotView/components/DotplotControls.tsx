import React from 'react'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import ZoomOut from '@mui/icons-material/ZoomOut'
import ZoomIn from '@mui/icons-material/ZoomIn'
import MoreVert from '@mui/icons-material/MoreVert'
import { CursorMouse, CursorMove } from './CursorIcon'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { DotplotViewModel } from '../model'

const DotplotControls = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <div>
      <IconButton onClick={model.zoomOutButton}>
        <ZoomOut />
      </IconButton>

      <IconButton onClick={model.zoomInButton}>
        <ZoomIn />
      </IconButton>

      <IconButton
        onClick={() => model.activateTrackSelector()}
        title="Open track selector"
      >
        <TrackSelectorIcon />
      </IconButton>

      <CascadingMenuButton
        menuItems={[
          {
            label: 'Square view - same base pairs per pixel',
            onClick: () => model.squareView(),
          },
          {
            label: 'Rectanglularize view - same total bp',
            onClick: () => model.squareViewProportional(),
          },
          {
            label: 'Show all regions',
            onClick: () => model.showAllRegions(),
          },
          {
            checked: model.drawCigar,
            label: 'Draw CIGAR',
            onClick: () => model.setDrawCigar(!model.drawCigar),
            type: 'checkbox',
          },
          {
            checked: model.showPanButtons,
            label: 'Show pan buttons',
            onClick: () => model.setShowPanButtons(!model.showPanButtons),
            type: 'checkbox',
          },
          {
            label: 'Click and drag mode',
            subMenu: [
              {
                checked: model.cursorMode === 'move',
                icon: CursorMove,
                label: 'Pan by default, select region when ctrl key is held',
                onClick: () => model.setCursorMode('move'),
                type: 'radio',
              },
              {
                checked: model.cursorMode === 'crosshair',
                icon: CursorMouse,
                label: 'Select region by default, pan when ctrl key is held',
                onClick: () => model.setCursorMode('crosshair'),
                type: 'radio',
              },
            ],
          },
          {
            label: 'Wheel scroll mode',
            subMenu: [
              {
                checked: model.wheelMode === 'pan',
                label: 'Pans view',
                onClick: () => model.setWheelMode('pan'),
                type: 'radio',
              },
              {
                checked: model.wheelMode === 'zoom',
                label: 'Zooms view',
                onClick: () => model.setWheelMode('zoom'),
                type: 'radio',
              },
              {
                checked: model.wheelMode === 'none',
                label: 'Disable',
                onClick: () => model.setWheelMode('none'),
                type: 'radio',
              },
            ],
          },
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>
    </div>
  )
})

export default DotplotControls
