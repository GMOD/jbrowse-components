import { useState } from 'react'

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
  const [size, setSize] = useState({ width: 800, height: 400 })

  return (
    <Portal>
      <ResizableDraggablePanel
        dragHandleClassName="viewHeader"
        defaultSize={size}
        minWidth={300}
        minHeight={200}
        style={{ zIndex }}
        onResize={setSize}
      >
        <StaticViewPanel
          view={view}
          session={session}
          contentHeight={size.height - VIEW_HEADER_HEIGHT}
        />
      </ResizableDraggablePanel>
    </Portal>
  )
})

export default FloatingViewPanel
