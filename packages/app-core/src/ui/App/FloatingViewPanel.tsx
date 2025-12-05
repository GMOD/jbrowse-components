import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { Portal } from '@mui/material'
import { observer } from 'mobx-react'

import ResizableDraggablePanel from './ResizableDraggablePanel'
import StaticViewPanel from './StaticViewPanel'

import type { AppSession } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'

const FloatingViewPanel = observer(function ({
  view,
  session,
}: {
  view: AbstractViewModel
  session: AppSession
}) {
  // above drawer https://mui.com/material-ui/customization/z-index/, but below
  // menu popovers
  const zIndex = session.focusedViewId === view.id ? 1202 : 1201
  const { floatingCoord } = view

  return (
    <Portal>
      <ResizableDraggablePanel
        dragHandleClassName="viewHeader"
        defaultPosition={{ x: floatingCoord.x, y: floatingCoord.y }}
        defaultSize={{
          width: floatingCoord.width,
          height: floatingCoord.height,
        }}
        minWidth={300}
        minHeight={200}
        style={{ zIndex }}
        onResize={size => {
          view.setFloatingCoord(size)
        }}
        onPositionChange={pos => {
          view.setFloatingCoord(pos)
        }}
      >
        <StaticViewPanel
          view={view}
          session={session}
          contentHeight={floatingCoord.height - VIEW_HEADER_HEIGHT}
        />
      </ResizableDraggablePanel>
    </Portal>
  )
})

export default FloatingViewPanel
