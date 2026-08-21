import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { toggleItem } from '@jbrowse/core/ui/menuItems'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ColorBySelector } from '@jbrowse/synteny-core'
import MoreVert from '@mui/icons-material/MoreVert'
import ShuffleIcon from '@mui/icons-material/Shuffle'
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
        menuItems={[
          {
            label: 'Square view - same bp per pixel',
            onClick: () => {
              model.squareView()
            },
            helpText: model.lockAspectRatio
              ? 'No effect while the aspect ratio is locked — the lock already keeps both axes at the same bp/px.'
              : 'Makes both views use the same zoom level (bp per pixel), adjusting to the average of each. This ensures features are displayed at comparable scales for easier visual comparison.',
          },
          {
            label: 'Rectangular view - same total bp',
            onClick: () => {
              model.squareViewProportional()
            },
            helpText: model.lockAspectRatio
              ? 'Overridden while the aspect ratio is locked — the lock re-equalizes bp/px immediately after.'
              : 'Adjusts zoom levels proportionally so both views show the same total number of base pairs. This accounts for different view widths while maintaining the same total genomic span.',
          },
          // beside the two view-shape commands above rather than filed by its
          // first word: all three are ways of setting zoom across both axes.
          {
            label: 'Show all regions',
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
              session.queueDialog(handleClose => [
                ReorderChromosomesDialog,
                {
                  handleClose,
                  model,
                },
              ])
            },
            helpText:
              'Diagonalization algorithmically reorders and reorients chromosomes to minimize crossing synteny lines, creating a more diagonal pattern. This makes it easier to identify large-scale genomic rearrangements, inversions, and translocations. The process runs on the webworker for better performance.',
          },
          // top level rather than under a "Show..." submenu holding it alone:
          // the two rows that shared that submenu draw the plot, so they went to
          // the settings menu, and a submenu for the one row left is a hop that
          // buys nothing. The label carries what the submenu used to.
          toggleItem(
            'Lock aspect ratio (same bp/px)',
            model.lockAspectRatio,
            // no squareView() call: the aspect-lock autorun observes this flag
            // and squares the axes the moment it goes on. Doing it here too ran
            // applySquare a second time over already-equal axes, whose centerAt
            // rounds offsetPx — so turning the lock on could nudge the plot by a
            // pixel for no reason.
            flag => {
              model.setLockAspectRatio(flag)
            },
            {
              helpText:
                'When enabled, both axes are kept at the same bp/px so the dotplot stays square as you zoom and pan.',
            },
          ),
        ]}
      >
        <MoreVert />
      </CascadingMenuButton>
      <ColorBySelector
        model={model}
        pointBased
        // the dotplot compares exactly two genomes, so there is no third
        // assembly for 'reference' to anchor on
        showReference={false}
      />

      {model.dotplotDisplays.length > 0 ? (
        <DotplotSettingsMenu model={model} />
      ) : null}
    </div>
  )
})

export default DotplotControls
