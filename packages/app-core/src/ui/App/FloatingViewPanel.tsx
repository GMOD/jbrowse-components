import React from 'react'
import { observer } from 'mobx-react'

// locals
import { AbstractViewModel, SessionWithDrawerWidgets } from '@jbrowse/core/util'
import { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'

// ui elements
import { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'
import DraggableDialog from '@jbrowse/core/ui/DraggableDialog'

// locals
import StaticViewPanel from './StaticViewPanel'

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
    <DraggableDialog open onClose={() => {}} maxWidth="xl" title="Testing">
      <div style={{ background: 'white', width: window.innerWidth * 0.85 }}>
        <StaticViewPanel view={view} session={session} />
      </div>
    </DraggableDialog>
  )
})

export default FloatingViewPanel
