import { FAB_Z_INDEX } from '@jbrowse/core/ui/zIndexes'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import LaunchIcon from '@mui/icons-material/Launch'
import { Fab, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { DrawerPosition } from '@jbrowse/core/util'

/** All the FAB needs of a session, narrowed the way `DrawerChromeSession` is. */
export interface AppFabSession {
  minimized: boolean
  activeWidgets: { size: number }
  drawerPosition: DrawerPosition
  showWidgetDrawer: () => void
}

// `absolute`, against the app root, rather than the `fixed` this used to
// carry. Fixed measures against the window, and the app root is only the
// window in a full-window app: under `--jbrowse-app-height` the app is a box
// somewhere on a host's page (see react-app's fit-to-container example), and
// this button was pinned to the page's corner instead of the app's. It is the
// only way back from a minimized drawer, so it cannot be somewhere else on the
// page.
const useStyles = makeStyles()(theme => ({
  fab: {
    zIndex: FAB_Z_INDEX,
    position: 'absolute',
    bottom: theme.spacing(2),
  },
  left: {
    left: theme.spacing(2),
  },
  right: {
    right: theme.spacing(2),
  },
}))

const AppFab = observer(function AppFab({
  session,
}: {
  session: AppFabSession
}) {
  const { minimized, activeWidgets, drawerPosition } = session
  const { classes, cx } = useStyles()

  return activeWidgets.size > 0 && minimized ? (
    <Tooltip title="Open drawer widget">
      <Fab
        className={cx(
          classes.fab,
          drawerPosition === 'right' ? classes.right : classes.left,
        )}
        color="primary"
        data-testid="drawer-maximize"
        onClick={() => {
          session.showWidgetDrawer()
        }}
      >
        <LaunchIcon />
      </Fab>
    </Tooltip>
  ) : null
})

export default AppFab
