import { lazy, useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getSession } from '@jbrowse/core/util'
import CropDinIcon from '@mui/icons-material/CropDin'
import CropLandscapeIcon from '@mui/icons-material/CropLandscape'
import MoreVert from '@mui/icons-material/MoreVert'
import SettingsOverscanIcon from '@mui/icons-material/SettingsOverscan'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import ColorBySelector from './ColorBySelector'
import { CursorMouse, CursorMove } from './CursorIcon'
import MinLengthSlider from './MinLengthSlider'
import OpacitySlider from './OpacitySlider'

import type { DotplotViewModel } from '../model'

const DiagonalizationProgressDialog = lazy(
  () => import('./DiagonalizationProgressDialog'),
)

const DotplotControls = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const [showDynamicControls, setShowDynamicControls] = useState(true)

  // Check if we have any displays to show sliders
  const hasDisplays = model.tracks[0]?.displays[0]

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
            helpText:
              'Makes both views use the same zoom level (bp per pixel), adjusting to the average of each. This ensures features are displayed at comparable scales for easier visual comparison.',
          },
          {
            label: 'Rectangular view - same total bp',
            icon: CropLandscapeIcon,
            onClick: () => {
              model.squareViewProportional()
            },
            helpText:
              'Adjusts zoom levels proportionally so both views show the same total number of base pairs. This accounts for different view widths while maintaining the same total genomic span.',
          },
          {
            label: 'Show all regions',
            icon: SettingsOverscanIcon,
            onClick: () => {
              model.showAllRegions()
            },
            helpText:
              'Zooms out to display all genome assemblies in their entirety. Useful for getting a high-level overview or resetting the view after zooming into specific regions.',
          },
          {
            label: 'Re-order chromosomes',
            icon: ShuffleIcon,
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                DiagonalizationProgressDialog,
                {
                  handleClose,
                  model,
                },
              ])
            },
            helpText:
              'Diagonalization algorithmically reorders and reorients chromosomes to minimize crossing synteny lines, creating a more diagonal pattern. This makes it easier to identify large-scale genomic rearrangements, inversions, and translocations. The process runs on the webworker for better performance.',
          },
          {
            type: 'checkbox',
            label: 'Draw CIGAR',
            checked: model.drawCigar,
            onClick: () => {
              model.setDrawCigar(!model.drawCigar)
            },
            helpText:
              'Toggle detailed CIGAR string visualization showing matches, insertions, and deletions in alignments. Disable for a cleaner view that shows only broad syntenic blocks.',
          },
          {
            label: 'Show pan buttons',
            type: 'checkbox',
            checked: model.showPanButtons,
            onClick: () => {
              model.setShowPanButtons(!model.showPanButtons)
            },
            helpText:
              'Show or hide directional pan buttons that allow you to navigate the dotplot view by clicking arrows. Useful for precise navigation without using mouse drag.',
          },
          {
            label: 'Show dynamic controls',
            type: 'checkbox',
            checked: showDynamicControls,
            onClick: () => {
              setShowDynamicControls(!showDynamicControls)
            },
            helpText:
              'Toggle visibility of dynamic controls like opacity and minimum length sliders. These controls allow you to adjust dotplot visualization parameters in real-time.',
          },
          {
            label: 'Click and drag mode',
            helpText:
              'Configure how clicking and dragging behaves in the dotplot view. Choose between panning and region selection as the default action.',
            subMenu: [
              {
                label: 'Pan by default',
                icon: CursorMove,
                type: 'radio',
                checked: model.cursorMode === 'move',
                onClick: () => {
                  model.setCursorMode('move')
                },
                helpText:
                  'Click and drag to pan the view. Hold Ctrl/Cmd while dragging to select a region for zooming or creating a linear synteny view.',
              },
              {
                label: 'Select region by default',
                icon: CursorMouse,
                type: 'radio',
                checked: model.cursorMode === 'crosshair',
                onClick: () => {
                  model.setCursorMode('crosshair')
                },
                helpText:
                  'Click and drag to select a region for zooming or creating a linear synteny view. Hold Ctrl/Cmd while dragging to pan the view instead.',
              },
            ],
          },
          {
            label: 'Wheel scroll mode',
            helpText:
              'Configure how mouse wheel scrolling behaves in the dotplot view.',
            subMenu: [
              {
                label: 'Pan view',
                type: 'radio',
                checked: model.wheelMode === 'pan',
                onClick: () => {
                  model.setWheelMode('pan')
                },
                helpText:
                  'Mouse wheel scrolling will pan the view up/down. Useful for navigating through the genome without changing zoom level.',
              },
              {
                label: 'Zoom view',
                type: 'radio',
                checked: model.wheelMode === 'zoom',
                onClick: () => {
                  model.setWheelMode('zoom')
                },
                helpText:
                  'Mouse wheel scrolling will zoom in/out of the view. Provides quick zoom control for detailed inspection of regions.',
              },
              {
                label: 'Disable',
                type: 'radio',
                checked: model.wheelMode === 'none',
                onClick: () => {
                  model.setWheelMode('none')
                },
                helpText:
                  'Mouse wheel scrolling will be disabled for the dotplot view. Use this to prevent accidental zoom or pan when scrolling the page.',
              },
            ],
          },
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>

      {hasDisplays && showDynamicControls ? (
        <>
          <OpacitySlider model={model} />
          <MinLengthSlider model={model} />
          <ColorBySelector model={model} />
        </>
      ) : null}
    </div>
  )
})

export default DotplotControls
