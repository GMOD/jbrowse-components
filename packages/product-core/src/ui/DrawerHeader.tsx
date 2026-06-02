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
  const appBarRef = useCallback(
    (ref: HTMLDivElement | null) => {
      setToolbarHeight(ref?.getBoundingClientRect().height ?? 0)
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
