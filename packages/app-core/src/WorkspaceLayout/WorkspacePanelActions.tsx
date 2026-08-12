import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit'
import TabIcon from '@mui/icons-material/Tab'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { DockviewSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
import type { PanelNode } from './tree.ts'

const useStyles = makeStyles()(theme => ({
  actions: { display: 'flex', alignItems: 'center', flex: '0 0 auto' },
  button: { padding: 4, color: theme.palette.text.secondary },
  icon: { fontSize: 16 },
}))

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
}: {
  panel: PanelNode
  session: DockviewSessionType & WorkspaceLayout
}) {
  const { classes } = useStyles()
  const canClose = session.panels.length > 1

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
        ]}
        size="small"
        className={classes.button}
      >
        <AddIcon className={classes.icon} />
      </CascadingMenuButton>
      {canClose ? (
        <Tooltip title="Close panel">
          <IconButton
            size="small"
            className={classes.button}
            onClick={() => {
              // closing a cell closes the views its tabs held, as before
              const ids = new Set(panel.tabs.flatMap(t => t.viewIds))
              for (const view of session.views.filter(v => ids.has(v.id))) {
                session.removeView(view)
              }
              session.closePanel(panel.id)
            }}
          >
            <CloseIcon className={classes.icon} />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  )
})
