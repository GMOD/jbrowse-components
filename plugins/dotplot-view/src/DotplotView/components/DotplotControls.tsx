import React from 'react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import MoreVert from '@mui/icons-material/MoreVert'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

// icons
import { CursorMouse, CursorMove } from './CursorIcon'

// locals
import type { DotplotViewModel } from '../model'

const DotplotControls = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <div>
      <IconButton
        onClick={() => {
          model.zoomOut()
        }}
      >
        <ZoomOut />
      </IconButton>

      <IconButton
        onClick={() => {
          model.zoomIn()
        }}
      >
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
            onClick: () => {
              model.squareView()
            },
            label: 'Square view - same base pairs per pixel',
          },
          {
            onClick: () => {
              model.squareViewProportional()
            },
            label: 'Rectanglularize view - same total bp',
          },
          {
            onClick: () => {
              model.showAllRegions()
            },
            label: 'Show all regions',
          },
          {
            onClick: () => {
              model.setDrawCigar(!model.drawCigar)
            },
            type: 'checkbox',
            label: 'Draw CIGAR',
            checked: model.drawCigar,
          },
          {
            onClick: () => {
              model.setShowPanButtons(!model.showPanButtons)
            },
            label: 'Show pan buttons',
            type: 'checkbox',
            checked: model.showPanButtons,
          },
          {
            label: 'Click and drag mode',
            subMenu: [
              {
                onClick: () => {
                  model.setCursorMode('move')
                },
                label:
                  'Pan by default, select region when ctrl/cmd key is held',
                icon: CursorMove,
                type: 'radio',
                checked: model.cursorMode === 'move',
              },
              {
                onClick: () => {
                  model.setCursorMode('crosshair')
                },
                label:
                  'Select region by default, pan when ctrl/cmd key is held',
                icon: CursorMouse,
                type: 'radio',
                checked: model.cursorMode === 'crosshair',
              },
            ],
          },
          {
            label: 'Wheel scroll mode',
            subMenu: [
              {
                onClick: () => {
                  model.setWheelMode('pan')
                },
                label: 'Pans view',
                type: 'radio',
                checked: model.wheelMode === 'pan',
              },
              {
                onClick: () => {
                  model.setWheelMode('zoom')
                },
                label: 'Zooms view',
                type: 'radio',
                checked: model.wheelMode === 'zoom',
              },
              {
                onClick: () => {
                  model.setWheelMode('none')
                },
                label: 'Disable',
                type: 'radio',
                checked: model.wheelMode === 'none',
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
