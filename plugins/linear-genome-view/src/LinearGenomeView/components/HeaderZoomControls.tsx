import { lazy, useEffect, useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import MoreVert from '@mui/icons-material/MoreVert'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Slider, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'

// lazies
const RegionWidthEditorDialog = lazy(() => import('./RegionWidthEditorDialog'))

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: 100,
    color: theme.palette.text.secondary,
  },
}))

const HeaderZoomControls = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { maxBpPerPx, minBpPerPx, bpPerPx } = model
  const [value, setValue] = useState(-Math.log2(bpPerPx) * 100)
  useEffect(() => {
    setValue(-Math.log2(bpPerPx) * 100)
  }, [bpPerPx])
  const zoomInDisabled = bpPerPx <= minBpPerPx + 0.0001
  const zoomOutDisabled = bpPerPx >= maxBpPerPx - 0.0001
  return (
    <div className={classes.container}>
      <Tooltip title="Zoom out 2x">
        <span>
          <IconButton
            data-testid="zoom_out"
            disabled={zoomOutDisabled}
            onClick={() => {
              model.zoom(bpPerPx * 2)
            }}
          >
            <ZoomOut />
          </IconButton>
        </span>
      </Tooltip>

      <Slider
        size="small"
        className={classes.slider}
        value={value}
        min={-Math.log2(maxBpPerPx) * 100}
        max={-Math.log2(minBpPerPx) * 100}
        onChangeCommitted={() => model.zoomTo(2 ** (-value / 100))}
        onChange={(_, val) => {
          setValue(val as number)
        }}
      />
      <Tooltip title="Zoom in 2x">
        <span>
          <IconButton
            data-testid="zoom_in"
            disabled={zoomInDisabled}
            onClick={() => {
              model.zoom(model.bpPerPx / 2)
            }}
          >
            <ZoomIn />
          </IconButton>
        </span>
      </Tooltip>

      <CascadingMenuButton
        menuItems={[
          ...[100, 50, 10].map(r => ({
            label: `Zoom in ${r}x`,
            onClick: () => {
              model.zoom(model.bpPerPx / r)
            },
          })),
          ...[10, 50, 100].map(r => ({
            label: `Zoom out ${r}x`,
            onClick: () => {
              model.zoom(model.bpPerPx * r)
            },
          })),
          {
            label: 'Custom zoom',
            onClick: () => {
              getSession(model).queueDialog(handleClose => [
                RegionWidthEditorDialog,
                {
                  model,
                  handleClose,
                },
              ])
            },
          },
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>
    </div>
  )
})

export default HeaderZoomControls
