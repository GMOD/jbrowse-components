import React, { useRef } from 'react'
import { Resizable, ResizableBox } from 'react-resizable'
import { observer } from 'mobx-react'

// locals
import { AbstractViewModel, SessionWithDrawerWidgets } from '@jbrowse/core/util'
import { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'

// ui elements
import { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'
import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'

// locals
import StaticViewPanel from './StaticViewPanel'
import './test.css'

type AppSession = SessionWithDrawerWidgets & {
  savedSessionNames: string[]
  menus: { label: string; menuItems: JBMenuItem[] }[]
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
}

const FloatingViewPanel = observer(function ({
  view,
  session,
}: {
  view: AbstractViewModel
  session: AppSession
}) {
  return (
    <DraggableDialog>
      {/* @ts-ignore */}
      <ResizableBox
        className="box"
        height={200}
        resizeHandles={['se']}
        width={1000}
      >
        <StaticViewPanel view={view} session={session} />
      </ResizableBox>
    </DraggableDialog>
  )
})

export default FloatingViewPanel
