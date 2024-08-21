import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'
import { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'

// locals
import ViewLauncher from './ViewLauncher'
import FloatingViewPanel from './FloatingViewPanel'
import StaticViewPanel from './StaticViewPanel'

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
        views.map(view =>
          view.isFloating ? (
            <FloatingViewPanel
              key={`view-${view.id}`}
              view={view}
              session={session}
            />
          ) : (
            <StaticViewPanel
              key={`view-${view.id}`}
              view={view}
              session={session}
            />
          ),
        )
      ) : (
        <ViewLauncher {...props} />
      )}

      {/* blank space at the bottom of screen allows scroll */}
      <div style={{ height: 300 }} />
    </div>
  )
})

export default ViewsContainer
