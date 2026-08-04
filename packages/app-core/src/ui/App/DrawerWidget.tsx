import { useState } from 'react'

import { WidgetBody } from '@jbrowse/product-core'
import { observer } from 'mobx-react'

import Drawer from './Drawer.tsx'
import DrawerHeader from './DrawerHeader.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { visibleWidget } = session

  // we track the toolbar height because components that use virtualized
  // height want to be able to fill the contained, minus the toolbar height
  // (the position static/sticky is included in AutoSizer estimates)
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
