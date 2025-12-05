import { useEffect, useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
} from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import JBrowseViewPanel from './JBrowseViewPanel'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

import 'dockview-react/dist/styles/dockview.css'

const useStyles = makeStyles()({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
  },
})

interface Props {
  session: SessionWithFocusedViewAndDrawerWidgets &
    AbstractViewContainer & {
      renameCurrentSession: (arg: string) => void
      snackbarMessages: SnackbarMessage[]
      popSnackbarMessage: () => unknown
    }
}

const components = {
  jbrowseView: JBrowseViewPanel,
}

const TiledViewsContainer = observer(function TiledViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const theme = useTheme()
  const apiRef = useRef<DockviewApi | null>(null)
  const viewIdsRef = useRef<Set<string>>(new Set())
  const removingFromDockviewRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const onReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api

    // Handle panel activation to sync focus
    event.api.onDidActivePanelChange(e => {
      if (e?.id) {
        sessionRef.current.setFocusedViewId?.(e.id)
      }
    })

    // Handle panel removal from dockview UI (close button)
    event.api.onDidRemovePanel(e => {
      if (removingFromDockviewRef.current) {
        return
      }
      const viewId = e.id
      viewIdsRef.current.delete(viewId)
      const view = sessionRef.current.views.find(v => v.id === viewId)
      if (view) {
        sessionRef.current.removeView(view)
      }
    })
  }

  // Use autorun to react to MobX observable changes
  useEffect(() => {
    const dispose = autorun(() => {
      const api = apiRef.current
      if (!api) {
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = viewIdsRef.current

      // Add new views
      views.forEach((view, idx) => {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)
          api.addPanel({
            id: view.id,
            component: 'jbrowseView',
            title: view.displayName || `View ${idx + 1}`,
            params: { view, session },
          })
        }
      })

      // Remove views that no longer exist (removed via session.removeView)
      ;[...trackedIds].forEach(id => {
        if (!currentViewIds.has(id)) {
          trackedIds.delete(id)
          const panel = api.getPanel(id)
          if (panel) {
            removingFromDockviewRef.current = true
            api.removePanel(panel)
            removingFromDockviewRef.current = false
          }
        }
      })

      // Update panel titles
      views.forEach((view, idx) => {
        const panel = api.getPanel(view.id)
        if (panel) {
          const newTitle = view.displayName || `View ${idx + 1}`
          panel.setTitle(newTitle)
        }
      })
    })

    return () => {
      dispose()
    }
  }, [session])

  const themeClass =
    theme.palette.mode === 'dark'
      ? 'dockview-theme-dark'
      : 'dockview-theme-light'

  return (
    <div className={`${classes.container} ${themeClass}`}>
      <DockviewReact components={components} onReady={onReady} />
    </div>
  )
})

export default TiledViewsContainer
