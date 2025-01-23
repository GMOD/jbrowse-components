import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import CropDinIcon from '@mui/icons-material/CropDin'
import CropLandscapeIcon from '@mui/icons-material/CropLandscape'
import MoreVert from '@mui/icons-material/MoreVert'
import SettingsOverscanIcon from '@mui/icons-material/SettingsOverscan'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { CursorMouse, CursorMove } from './CursorIcon'

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
            label: 'Square view - same bp per pixel',
            icon: CropDinIcon,
            onClick: () => {
              model.squareView()
            },
          },
          {
            label: 'Rectangular view - same total bp',
            icon: CropLandscapeIcon,
            onClick: () => {
              model.squareViewProportional()
            },
          },
          {
            label: 'Show all regions',
            icon: SettingsOverscanIcon,
            onClick: () => {
              model.showAllRegions()
            },
          },
          {
            type: 'checkbox',
            label: 'Draw CIGAR',
            checked: model.drawCigar,
            onClick: () => {
              model.setDrawCigar(!model.drawCigar)
            },
          },
          {
            label: 'Show pan buttons',
            type: 'checkbox',
            checked: model.showPanButtons,
            onClick: () => {
              model.setShowPanButtons(!model.showPanButtons)
            },
          },
          {
            label: 'Click and drag mode',
            subMenu: [
              {
                label:
                  'Pan by default, select region when ctrl/cmd key is held',
                icon: CursorMove,
                type: 'radio',
                checked: model.cursorMode === 'move',
                onClick: () => {
                  model.setCursorMode('move')
                },
              },
              {
                label:
                  'Select region by default, pan when ctrl/cmd key is held',
                icon: CursorMouse,
                type: 'radio',
                checked: model.cursorMode === 'crosshair',
                onClick: () => {
                  model.setCursorMode('crosshair')
                },
              },
            ],
          },
          {
            label: 'Wheel scroll mode',
            subMenu: [
              {
                label: 'Pans view',
                type: 'radio',
                checked: model.wheelMode === 'pan',
                onClick: () => {
                  model.setWheelMode('pan')
                },
              },
              {
                label: 'Zooms view',
                type: 'radio',
                checked: model.wheelMode === 'zoom',
                onClick: () => {
                  model.setWheelMode('zoom')
                },
              },
              {
                label: 'Disable',
                type: 'radio',
                checked: model.wheelMode === 'none',
                onClick: () => {
                  model.setWheelMode('none')
                },
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
