import { useState } from 'react'

import { observer } from 'mobx-react'

import Drawer from './Drawer.tsx'
import DrawerHeader from './DrawerHeader.tsx'
import WidgetBody from './WidgetBody.tsx'

import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

/**
 * The session's visible widget in the drawer, under its header. A host adds
 * to it through `ref` (the drawer's paper), `headerClassName` and
 * `headerButtons`, which go where `Drawer` and `DrawerHeader` take them.
 */
const DrawerWidget = observer(function DrawerWidget({
  session,
  ref,
  headerClassName,
  headerButtons,
}: {
  session: SessionWithDrawerWidgets
  ref?: React.Ref<HTMLDivElement>
  headerClassName?: string
  headerButtons?: React.ReactNode
}) {
  const { visibleWidget } = session
  const [toolbarHeight, setToolbarHeight] = useState(0)

  return (
    <Drawer session={session} ref={ref}>
      <DrawerHeader
        session={session}
        setToolbarHeight={setToolbarHeight}
        className={headerClassName}
      >
        {headerButtons}
      </DrawerHeader>
      {visibleWidget ? (
        <WidgetBody
          session={session}
          widget={visibleWidget}
          toolbarHeight={toolbarHeight}
        />
      ) : null}
    </Drawer>
  )
})

export default DrawerWidget
