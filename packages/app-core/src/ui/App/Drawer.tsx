import { useRef } from 'react'

import { useFocusOnInteraction } from '@jbrowse/core/util'
import { Drawer as DrawerShell } from '@jbrowse/product-core'
import { observer } from 'mobx-react'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const Drawer = observer(function Drawer({
  children,
  session,
}: {
  children: React.ReactNode
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const ref = useRef<HTMLDivElement>(null)

  useFocusOnInteraction(ref, () => {
    const visibleWidgetId = session.visibleWidget?.view?.id
    if (visibleWidgetId) {
      session.setFocusedViewId(visibleWidgetId)
    }
  })

  return (
    <DrawerShell session={session} ref={ref}>
      {children}
    </DrawerShell>
  )
})

export default Drawer
