import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ColorBySelector } from '@jbrowse/synteny-core'
import MoreVert from '@mui/icons-material/MoreVert'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { CursorMouse, CursorMove } from './CursorIcon.tsx'
import DotplotSettingsPopover from './DotplotSettingsPopover.tsx'

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
          // top level, not under "Show...": that submenu is visibility toggles,
          // and this is a navigation gesture, filed by its first word rather
          // than by what it does. It belongs beside the two view-shape commands
          // above, which are the other two ways of setting zoom across axes.
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
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              {
                type: 'checkbox',
                label: 'Draw CIGAR insertions/deletions',
                checked: model.drawCigar,
                onClick: () => {
                  model.setDrawCigar(!model.drawCigar)
                },
                helpText:
                  'Toggle detailed CIGAR string visualization showing matches, insertions, and deletions in alignments. Disable for a cleaner view that shows only broad syntenic blocks.',
              },
              {
                type: 'checkbox',
                label: 'Lock aspect ratio (same bp/px)',
                checked: model.lockAspectRatio,
                // no squareView() call: the aspect-lock autorun observes this
                // flag and squares the axes the moment it goes on. Doing it here
                // too ran applySquare a second time over already-equal axes,
                // whose centerAt rounds offsetPx — so turning the lock on could
                // nudge the plot by a pixel for no reason.
                onClick: () => {
                  model.setLockAspectRatio(!model.lockAspectRatio)
                },
                helpText:
                  'When enabled, both axes are kept at the same bp/px so the dotplot stays square as you zoom and pan.',
              },
              toggleItem(
                // a plot with no room for a ruler on either axis has no
                // gridlines to draw, and the box stays ticked through it
                withHint(
                  'Gridlines',
                  model.gridlinesEmpty ? 'none at this zoom' : undefined,
                ),
                model.showGridlines,
                flag => {
                  model.setShowGridlines(flag)
                },
                {
                  helpText:
                    "Carries each axis' ruler ticks across the plot as faint lines, in two weights, so a point can be read back to a coordinate without tracing to the axis. An axis with no room to number itself draws none at all, which at whole-genome zoom is both of them, and a tick already marked by a chromosome boundary is left to the boundary.",
                },
              ),
            ],
          },
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
        <DotplotSettingsPopover model={model} />
      ) : null}
    </div>
  )
})

export default DotplotControls
