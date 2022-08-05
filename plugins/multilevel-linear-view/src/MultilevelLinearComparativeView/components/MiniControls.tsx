import React from 'react'
import { observer } from 'mobx-react'
import { Tooltip } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import MenuIcon from '@mui/icons-material/Menu'
import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'

import {
  bindTrigger,
  bindPopover,
  usePopupState,
} from 'material-ui-popup-state/hooks'

import LabelField from './LabelField'
import { RegionWidth } from './Controls'

const MiniControls = observer((props: { model: LinearGenomeViewModel }) => {
  const { model } = props
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor } = model

  const popupState = usePopupState({
    popupId: 'mllvViewMenu',
    variant: 'popover',
  })

  return (
    <div style={{ position: 'absolute', right: '0px', zIndex: '1001' }}>
      <Paper
        style={{ background: '#aaa7', display: 'flex', alignItems: 'center' }}
      >
        <div>
          <IconButton
            {...bindTrigger(popupState)}
            color="secondary"
            data-testid="mllv-minicontrols-menu"
          >
            <MenuIcon />
          </IconButton>
          <CascadingMenu
            {...bindPopover(popupState)}
            onMenuItemClick={(_: unknown, callback: Function) => callback()}
            menuItems={model.menuItems()}
            popupState={popupState}
          />
          {/* @ts-ignore */}
          <LabelField model={model} />
        </div>
        <div>
          {/* @ts-ignore */}
          <RegionWidth model={model} />
        </div>
        <div data-testid="mllv-minicontrols">
          {
            // @ts-ignore
            model.limitBpPerPx.limited &&
            // @ts-ignore
            bpPerPx * 2 > model.limitBpPerPx.upperLimit ? (
              <Tooltip
                title="The view is at its max zoom level relative to its neighbouring views"
                arrow
              >
                <span>
                  <IconButton disabled data-testid="zoom_out">
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
            )
          }
          {
            // @ts-ignore
            model.limitBpPerPx.limited &&
            // @ts-ignore
            bpPerPx / 2 < model.limitBpPerPx.lowerLimit ? (
              <Tooltip
                title="The view is at its min zoom level relative to its neighbouring views"
                arrow
              >
                <span>
                  <IconButton disabled data-testid="zoom_in">
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
            )
          }
        </div>
      </Paper>
    </div>
  )
})

export default MiniControls
