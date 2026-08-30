import { useCallback } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { AppBar, Toolbar } from '@mui/material'
import { observer } from 'mobx-react'

import DrawerControls from './DrawerControls.tsx'
import DrawerWidgetSelector from './DrawerWidgetSelector.tsx'

import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  appBar: {
    background: theme.palette.secondary.main,
  },
  spacer: {
    flexGrow: 1,
  },
}))

const DrawerHeader = observer(function DrawerHeader({
  session,
  setToolbarHeight,
}: {
  session: SessionWithDrawerWidgets
  setToolbarHeight: (arg: number) => void
}) {
  const { classes } = useStyles()
  // Measured, and re-measured: the toolbar's height is the room a virtualized
  // widget subtracts from the box it is given, and it changes without this
  // component re-rendering -- MUI's Toolbar is 56px under the `sm` breakpoint
  // and 64 above it, and grows again with the root font size. Read once at
  // mount, a widget's list was that much too tall for the rest of the session.
  const appBarRef = useCallback(
    (node: HTMLDivElement) => {
      const publish = () => {
        setToolbarHeight(node.getBoundingClientRect().height)
      }
      publish()
      const observer = new ResizeObserver(publish)
      observer.observe(node)
      return () => {
        observer.disconnect()
      }
    },
    [setToolbarHeight],
  )

  return (
    <AppBar position="sticky" className={classes.appBar} ref={appBarRef}>
      <Toolbar disableGutters>
        <DrawerWidgetSelector session={session} />
        <div className={classes.spacer} />
        <DrawerControls session={session} />
      </Toolbar>
    </AppBar>
  )
})

export default DrawerHeader
