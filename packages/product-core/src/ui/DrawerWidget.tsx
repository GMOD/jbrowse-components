import { useState } from 'react'

import { observer } from 'mobx-react'

import Drawer from './Drawer.tsx'
import DrawerHeader from './DrawerHeader.tsx'
import WidgetBody from './WidgetBody.tsx'

import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { visibleWidget } = session
  const [toolbarHeight, setToolbarHeight] = useState(0)

  return (
    <Drawer session={session}>
      <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
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
