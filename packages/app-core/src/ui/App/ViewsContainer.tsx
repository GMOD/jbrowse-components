import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import ViewLauncher from './ViewLauncher'
import ViewPanel from './ViewPanel'
import type { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  viewsContainer: {
    overflowY: 'auto',
    gridRow: 'components',
  },
})

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithFocusedViewAndDrawerWidgets & {
    savedSessionNames: string[]
    menus: { label: string; menuItems: JBMenuItem[] }[]
    renameCurrentSession: (arg: string) => void
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
  }
}

const ViewsContainer = observer(function ViewsContainer(props: Props) {
  const { session } = props
  const { views } = session
  const { classes } = useStyles()
  return (
    <div className={classes.viewsContainer}>
      {views.length > 0 ? (
        views.map(view => (
          <ViewPanel key={`view-${view.id}`} view={view} session={session} />
        ))
      ) : (
        <ViewLauncher {...props} />
      )}

      {/* blank space at the bottom of screen allows scroll */}
      <div style={{ height: 300 }} />
    </div>
  )
})

export default ViewsContainer
