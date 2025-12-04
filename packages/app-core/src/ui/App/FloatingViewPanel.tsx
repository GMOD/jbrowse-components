import { useState } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { ResizableBox } from 'react-resizable'

import DraggableViewPanel from './DraggableViewPanel'
import StaticViewPanel from './StaticViewPanel'

import type { AppSession } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'

import './FloatingViewPanel.css'

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
    <DraggableViewPanel zIndex={zIndex}>
      <ResizableBox
        className="box"
        height={size.height}
        width={size.width}
        resizeHandles={['se', 'e', 's']}
        onResize={(_event, { size }) => {
          setSize(size)
        }}
      >
        <StaticViewPanel
          view={view}
          session={session}
          contentHeight={size.height - VIEW_HEADER_HEIGHT}
        />
      </ResizableBox>
    </DraggableViewPanel>
  )
})

export default FloatingViewPanel
