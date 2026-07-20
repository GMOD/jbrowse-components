import { lazy, useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getBpDisplayStr, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVert from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import ZoomButton from './ZoomButton.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const RegionWidthEditorDialog = lazy(
  () => import('./RegionWidthEditorDialog.tsx'),
)

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

function getZoomMenuItems(model: LinearGenomeViewModel) {
  return [
    ...[10, 50, 100].map(r => ({
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
  ]
}

// The slider tracks live `bpPerPx`, which changes on every animation frame of a
// zoom. Isolated into its own observer so the surrounding zoom buttons/menu —
// whose MUI Tooltip/IconButton machinery is comparatively expensive and only
// depends on the debounced `coarseBpPerPx` — don't re-render every frame.
const ZoomSlider = observer(function ZoomSlider({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { width, maxBpPerPx, minBpPerPx, bpPerPx } = model
  const [dragValue, setDragValue] = useState<number | null>(null)
  const value = dragValue ?? -Math.log2(bpPerPx) * 100
  return (
    <SingleSlider
      size="small"
      className={classes.slider}
      value={value}
      min={-Math.log2(maxBpPerPx) * 100}
      max={-Math.log2(minBpPerPx) * 100}
      onChangeCommitted={val => {
        setDragValue(null)
        model.cancelZoomAnimation()
        model.zoomTo(2 ** (-val / 100))
      }}
      valueLabelDisplay="auto"
      valueLabelFormat={newValue =>
        `Window size: ${getBpDisplayStr(2 ** (-newValue / 100) * width)}`
      }
      onChange={val => {
        // Take over from any in-flight animated zoom as soon as the user grabs
        // the thumb, so the view stops lurching underneath the drag.
        if (dragValue === null) {
          model.cancelZoomAnimation()
        }
        setDragValue(val)
      }}
    />
  )
})

const HeaderZoomControls = observer(function HeaderZoomControls({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.container}>
      <ZoomButton model={model} direction="out" />
      <ZoomSlider model={model} />
      <ZoomButton model={model} direction="in" />
      <CascadingMenuButton menuItems={() => getZoomMenuItems(model)}>
        <MoreVert />
      </CascadingMenuButton>
    </div>
  )
})

export default HeaderZoomControls
