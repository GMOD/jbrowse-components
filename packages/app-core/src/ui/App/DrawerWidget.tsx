import { useRef } from 'react'

import { useFocusOnInteraction } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DrawerWidget as DrawerWidgetShell } from '@jbrowse/product-core'
import { observer } from 'mobx-react'

import DrawerHeaderButtons from './DrawerHeaderButtons.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  headerUnfocused: {
    background: theme.palette.secondary.dark,
  },
}))

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { classes } = useStyles()
  const ref = useRef<HTMLDivElement>(null)
  const { focusedViewId, visibleWidget } = session
  const viewWidgetId = visibleWidget?.view?.id

  useFocusOnInteraction(ref, () => {
    const visibleWidgetId = session.visibleWidget?.view?.id
    if (visibleWidgetId) {
      session.setFocusedViewId(visibleWidgetId)
    }
  })

  return (
    <DrawerWidgetShell
      session={session}
      ref={ref}
      headerClassName={
        viewWidgetId !== undefined && focusedViewId === viewWidgetId
          ? undefined
          : classes.headerUnfocused
      }
      headerButtons={<DrawerHeaderButtons session={session} />}
    />
  )
})

export default DrawerWidget
