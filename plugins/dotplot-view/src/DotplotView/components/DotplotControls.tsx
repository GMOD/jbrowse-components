import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ColorBySelector,
  reorderChromosomesMenuItem,
} from '@jbrowse/synteny-core'
import MoreVert from '@mui/icons-material/MoreVert'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { CursorMouse, CursorMove } from './CursorIcon.tsx'
import DotplotSettingsMenu from './DotplotSettingsMenu.tsx'

import type { DotplotViewModel } from '../model.ts'

const ReorderChromosomesDialog = lazy(
  () => import('./ReorderChromosomesDialog.tsx'),
)

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
})

const DotplotControls = observer(function DotplotControls({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)

  return (
    <div className={classes.root}>
      {isSessionModelWithWidgets(session) ? (
        <IconButton
          onClick={() => {
            model.activateTrackSelector()
          }}
          title="Open track selector"
        >
          <TrackSelectorIcon />
        </IconButton>
      ) : null}
      <IconButton
        onClick={() => {
          model.zoomOut()
        }}
        title="Zoom out"
      >
        <ZoomOut />
      </IconButton>

      <IconButton
        onClick={() => {
          model.zoomIn()
        }}
        title="Zoom in"
      >
        <ZoomIn />
      </IconButton>

      <IconButton
        onClick={() => {
          model.setCursorMode(
            model.cursorMode === 'move' ? 'crosshair' : 'move',
          )
        }}
        title={
          model.cursorMode === 'move'
            ? 'Drag pans (click to switch to region select)'
            : 'Drag selects region (click to switch to pan)'
        }
      >
        {model.cursorMode === 'move' ? <CursorMove /> : <CursorMouse />}
      </IconButton>

      <CascadingMenuButton
        // The testid and the name ride through CascadingMenuButton's `...rest`
        // onto the IconButton, the way ColorBySelector's `color_by_menu` does;
        // a tooltip would name it too, and would then open under the cursor
        // over the top of the menu it just opened.
        data-testid="dotplot_view_menu"
        aria-label="Zoom and layout options"
        menuItems={[
          {
            label: 'Show whole genome',
            onClick: () => {
              model.showAllRegions()
            },
            helpText: 'Zooms out to show every assembly whole.',
          },
          ...(model.ratio === 1
            ? []
            : [
                {
                  label: 'Square view - same bp per pixel',
                  onClick: () => {
                    model.squareView()
                  },
                  helpText:
                    'Puts both axes on the same bp per pixel, the average of the two.',
                },
                {
                  label: 'Rectangular view - same total bp',
                  onClick: () => {
                    model.squareViewProportional()
                  },
                  helpText:
                    'Zooms both axes to show the same total bp, whatever their widths.',
                },
              ]),
          reorderChromosomesMenuItem(() => {
            session.queueDialog(handleClose => [
              ReorderChromosomesDialog,
              {
                handleClose,
                model,
              },
            ])
          }),
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>
      <ColorBySelector model={model} />

      {model.dotplotDisplays.length > 0 ? (
        <DotplotSettingsMenu model={model} />
      ) : null}
    </div>
  )
})

export default DotplotControls
