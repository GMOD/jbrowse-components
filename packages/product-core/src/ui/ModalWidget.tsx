import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import ModalWidgetAppBar from './ModalWidgetAppBar.tsx'
import WidgetBody from './WidgetBody.tsx'

import type { SessionWithWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  paper: {
    overflow: 'auto',
    // the track selector's fab positions against this
    position: 'relative',
    width: 800,
    maxWidth: '100%',
    // matches the drawer's sense of "tall but not full screen", and unlike a
    // window.innerHeight read it keeps up with a window resize
    height: '62.5vh',
  },
})

/**
 * Renders the session's visible widget in a modal dialog rather than a drawer.
 * `onClose` is caller-owned: in the app the modal is a pop-out of the drawer and
 * closing returns the widget to it, while in embedded products the modal is the
 * only widget surface and closing must dismiss the widget outright.
 */
const ModalWidget = observer(function ModalWidget({
  session,
  onClose,
}: {
  session: SessionWithWidgets
  onClose: () => void
}) {
  const { classes } = useStyles()
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)

  return visibleWidget ? (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      header={
        <ModalWidgetAppBar
          widget={visibleWidget}
          pluginManager={pluginManager}
          onClose={onClose}
        />
      }
    >
      <Paper className={classes.paper}>
        <WidgetBody session={session} widget={visibleWidget} />
      </Paper>
    </Dialog>
  ) : null
})

export default ModalWidget
