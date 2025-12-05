import { useState } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'
import { ResizableBox } from 'react-resizable'

import DraggableViewPanel from './DraggableViewPanel'
import StaticViewPanel from './StaticViewPanel'

import type { AppSession } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'

const resizeHandleBase = {
  position: 'absolute' as const,
  width: 20,
  height: 20,
  backgroundRepeat: 'no-repeat',
  backgroundOrigin: 'content-box',
  boxSizing: 'border-box' as const,
  backgroundImage:
    "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2IDYiIHN0eWxlPSJiYWNrZ3JvdW5kLWNvbG9yOiNmZmZmZmYwMCIgeD0iMHB4IiB5PSIwcHgiIHdpZHRoPSI2cHgiIGhlaWdodD0iNnB4Ij48ZyBvcGFjaXR5PSIwLjMwMiI+PHBhdGggZD0iTSA2IDYgTCAwIDYgTCAwIDQuMiBMIDQgNC4yIEwgNC4yIDQuMiBMIDQuMiAwIEwgNiAwIEwgNiA2IEwgNiA2IFoiIGZpbGw9IiMwMDAwMDAiLz48L2c+PC9zdmc+')",
  backgroundPosition: 'bottom right',
  padding: '0 3px 3px 0',
}

const useStyles = makeStyles()({
  resizable: {
    position: 'relative',
    '& .react-resizable-handle': resizeHandleBase,
    '& .react-resizable-handle-se': {
      bottom: 0,
      right: 0,
      cursor: 'se-resize',
    },
    '& .react-resizable-handle-e': {
      top: '50%',
      marginTop: -10,
      right: 0,
      cursor: 'ew-resize',
      transform: 'rotate(315deg)',
    },
    '& .react-resizable-handle-s': {
      left: '50%',
      marginLeft: -10,
      bottom: 0,
      cursor: 'ns-resize',
      transform: 'rotate(45deg)',
    },
  },
})

const FloatingViewPanel = observer(function ({
  view,
  session,
}: {
  view: AbstractViewModel
  session: AppSession
}) {
  const { classes } = useStyles()
  // above drawer https://mui.com/material-ui/customization/z-index/, but below
  // menu popovers
  const zIndex = session.focusedViewId === view.id ? 1202 : 1201
  const [size, setSize] = useState({ width: 800, height: 400 })

  return (
    <DraggableViewPanel zIndex={zIndex}>
      <ResizableBox
        className={classes.resizable}
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
