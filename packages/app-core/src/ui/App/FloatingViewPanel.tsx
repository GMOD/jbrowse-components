import { useEffect, useState } from 'react'

import useMeasure from '@jbrowse/core/util/useMeasure'
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
  const [ref, { height }] = useMeasure()
  const [mode, setMode] = useState<'se' | 'e'>('se')
  const [size, setSize] = useState<{ width: number; height: number }>()
  const h = size !== undefined ? size.height : undefined

  useEffect(() => {
    if (h !== undefined && height !== undefined && height - h > 50) {
      setMode('e')
    }
  }, [h, height])

  return (
    <DraggableViewPanel zIndex={zIndex}>
      <ResizableBox
        className="box"
        height={(height || 100) + 20}
        resizeHandles={[mode]}
        width={1000}
        onResize={(_event, { size }) => {
          setSize(size)
        }}
      >
        <div ref={ref}>
          <StaticViewPanel view={view} session={session} />
        </div>
      </ResizableBox>
    </DraggableViewPanel>
  )
})

export default FloatingViewPanel
