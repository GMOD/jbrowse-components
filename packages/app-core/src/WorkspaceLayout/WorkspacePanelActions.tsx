import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed'
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import TabIcon from '@mui/icons-material/Tab'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { dv } from './dockviewTheme.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
import type { TileMode } from './spec.ts'
import type { PanelNode } from './tree.ts'

const useStyles = makeStyles()({
  actions: { display: 'flex', alignItems: 'center', flex: '0 0 auto' },
  // dockview's `.dv-default-tab-action`: inherits the strip's colour, and takes
  // a small rounded chip on hover rather than MUI's circular ripple surface
  button: {
    padding: 4,
    borderRadius: 2,
    color: dv.activeGroupHiddenTabColor,
    '&:hover': { background: dv.iconHoverBackground, borderRadius: 2 },
  },
  icon: { fontSize: 16 },
})

/**
 * The per-cell buttons: new tab, split, close.
 *
 * Every one of these is a single MST action on the layout, where the dockview
 * versions were an api call plus a session write that had to be kept consistent
 * with it — `handleSplit` was `containerApi.addGroup(...)` followed by
 * `addEmptyTab(newGroup)`, and the gap between those two was where the
 * "resource is already disposed" crash lived.
 */
export const WorkspacePanelActions = observer(function WorkspacePanelActions({
  panel,
  session,
  onClose,
}: {
  panel: PanelNode
  session: WorkspaceSessionType & WorkspaceLayout
  /**
   * Closing a cell closes the views its tabs held, and the layout does not own
   * views — so the pair is one function at the call site, the same way
   * `WorkspaceTab` takes its `onClose`. Spelled here as well, this file would
   * be the third place stating "and also remove the views", which is one more
   * than the number that can be kept in step.
   */
  onClose: () => void
}) {
  const { classes } = useStyles()
  const canClose = session.panels.length > 1
  const maximized = session.maximizedPanelId === panel.id
  const tile = (mode: TileMode) => {
    session.tileViews(
      mode,
      session.views.map(v => v.id),
    )
  }

  return (
    <div className={classes.actions}>
      <CascadingMenuButton
        menuItems={[
          {
            label: 'New empty tab',
            icon: TabIcon,
            onClick: () => {
              session.addTab(panel.id)
            },
          },
          {
            label: 'New empty split horizontal',
            icon: VerticalSplitIcon,
            onClick: () => {
              session.splitPanel(panel.id, 'row')
            },
          },
          {
            label: 'New empty split vertical',
            icon: HorizontalSplitIcon,
            onClick: () => {
              session.splitPanel(panel.id, 'column')
            },
          },
          // The strip's double-click is the gesture; this is how anyone finds
          // it, and the only way to reach it from the keyboard. Gated on there
          // being another cell to hide, since maximizing the only one is a
          // no-op with a label promising otherwise.
          ...(session.panels.length > 1 || maximized
            ? [
                {
                  label: maximized ? 'Restore panel' : 'Maximize panel',
                  icon: maximized ? CloseFullscreenIcon : OpenInFullIcon,
                  onClick: () => {
                    session.toggleMaximizedPanel(panel.id)
                  },
                },
              ]
            : []),
          // The whole-workspace commands, kept behind the same "Global:" prefix
          // and the same >1-view gate they had on the dockview header, so a
          // returning user finds them where they were and the label still says
          // that the button in THIS cell rearranges every cell.
          ...(session.views.length > 1
            ? ([
                {
                  label: 'Global: change layout into set of tabs',
                  icon: DynamicFeedIcon,
                  onClick: () => {
                    tile('tabs')
                  },
                },
                {
                  label: 'Global: tile horizontally',
                  icon: ViewColumnIcon,
                  onClick: () => {
                    tile('horizontal')
                  },
                },
                {
                  label: 'Global: tile vertically',
                  icon: TableRowsIcon,
                  onClick: () => {
                    tile('vertical')
                  },
                },
                {
                  label: 'Global: tile grid',
                  icon: ViewModuleIcon,
                  onClick: () => {
                    tile('grid')
                  },
                },
              ] as const)
            : []),
        ]}
        size="small"
        className={classes.button}
      >
        <AddIcon className={classes.icon} />
      </CascadingMenuButton>
      {canClose ? (
        <Tooltip title="Close panel">
          <IconButton size="small" className={classes.button} onClick={onClose}>
            <CloseIcon className={classes.icon} />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  )
})
