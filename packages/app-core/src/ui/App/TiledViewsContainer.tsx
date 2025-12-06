import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit'
import TabIcon from '@mui/icons-material/Tab'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
} from '@mui/material'
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewHeaderActionsProps,
  type IDockviewPanelProps,
} from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { DockviewContext, useDockview } from './DockviewContext'
import JBrowseViewPanel, { JBrowseViewTab } from './JBrowseViewPanel'

import { isSessionWithDockviewLayout } from '../../DockviewLayout'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

import 'dockview-react/dist/styles/dockview.css'

const ViewLauncher = lazy(() => import('./ViewLauncher'))

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
  },
  addButton: {
    padding: 4,
    color: theme.palette.primary.contrastText,
  },
  addIcon: {
    fontSize: 16,
  },
}))

type SessionType = SessionWithFocusedViewAndDrawerWidgets &
  AbstractViewContainer & {
    renameCurrentSession: (arg: string) => void
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
  }

interface Props {
  session: SessionType
}

interface EmptyPanelParams {
  session: SessionType
}

const EmptyPanel = observer(function EmptyPanel({
  params,
}: IDockviewPanelProps<EmptyPanelParams>) {
  const { session } = params
  return (
    <Suspense fallback={null}>
      <ViewLauncher session={session} />
    </Suspense>
  )
})

const components = {
  jbrowseView: JBrowseViewPanel,
  emptyPanel: EmptyPanel,
}

const tabComponents = {
  jbrowseTab: JBrowseViewTab,
}

function LeftHeaderActions({ containerApi, group }: IDockviewHeaderActionsProps) {
  const { classes } = useStyles()
  const { addEmptyTab } = useDockview()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleNewTab = () => {
    addEmptyTab()
    handleClose()
  }

  const handleSplitRight = () => {
    const activePanel = group.activePanel
    if (activePanel) {
      activePanel.api.moveTo({
        group: containerApi.addGroup({
          referenceGroup: group,
          direction: 'right',
        }),
      })
    }
    handleClose()
  }

  const handleSplitDown = () => {
    const activePanel = group.activePanel
    if (activePanel) {
      activePanel.api.moveTo({
        group: containerApi.addGroup({
          referenceGroup: group,
          direction: 'below',
        }),
      })
    }
    handleClose()
  }

  return (
    <div className={classes.headerActions}>
      <Tooltip title="Layout options">
        <IconButton size="small" onClick={handleClick} className={classes.addButton}>
          <AddIcon className={classes.addIcon} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem onClick={handleNewTab}>
          <ListItemIcon>
            <TabIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New empty tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSplitRight}>
          <ListItemIcon>
            <VerticalSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Split right</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSplitDown}>
          <ListItemIcon>
            <HorizontalSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Split down</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  )
}

const TiledViewsContainer = observer(function TiledViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const theme = useTheme()
  const [api, setApi] = useState<DockviewApi | null>(null)
  const trackedViewIdsRef = useRef<Set<string>>(new Set())
  const rearrangingRef = useRef(false)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const rearrangePanels = useCallback(
    (arrange: (api: DockviewApi) => void) => {
      if (!api) {
        return
      }
      rearrangingRef.current = true
      try {
        arrange(api)
      } finally {
        rearrangingRef.current = false
      }
    },
    [api],
  )

  const addEmptyTab = useCallback(() => {
    if (!api) {
      return
    }
    const activeGroup = api.activeGroup
    const panelId = `panel-${nanoid()}`
    api.addPanel({
      id: panelId,
      component: 'jbrowseView',
      tabComponent: 'jbrowseTab',
      title: 'New Tab',
      params: { panelId, session },
      position: activeGroup ? { referenceGroup: activeGroup } : undefined,
    })

    // Set this as the active panel
    if (isSessionWithDockviewLayout(session)) {
      session.setActivePanelId(panelId)
    }
  }, [api, session])

  const contextValue = useMemo(
    () => ({ api, rearrangePanels, addEmptyTab }),
    [api, rearrangePanels, addEmptyTab],
  )

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event.api)

    // Handle panel activation to sync focus
    event.api.onDidActivePanelChange(e => {
      if (e?.id && isSessionWithDockviewLayout(sessionRef.current)) {
        sessionRef.current.setActivePanelId(e.id)
      }
    })

    // Handle panel removal from dockview UI (close button)
    event.api.onDidRemovePanel(e => {
      if (rearrangingRef.current) {
        return
      }
      const panelId = e.id

      // Remove the panel and its view assignments
      if (isSessionWithDockviewLayout(sessionRef.current)) {
        const viewIds = sessionRef.current.getViewIdsForPanel(panelId)
        // Remove all views assigned to this panel
        for (const viewId of viewIds) {
          const view = sessionRef.current.views.find(v => v.id === viewId)
          if (view) {
            sessionRef.current.removeView(view)
          }
        }
        sessionRef.current.removePanel(panelId)
      }
    })

    // Save layout when panels are added, removed, or moved
    event.api.onDidLayoutChange(() => {
      if (!rearrangingRef.current && isSessionWithDockviewLayout(sessionRef.current)) {
        // Use JSON.parse/stringify because structuredClone can't handle MobX proxies
        const layout = JSON.parse(JSON.stringify(event.api.toJSON()))
        sessionRef.current.setDockviewLayout(layout)
      }
    })

    // Restore layout if available, otherwise create initial panel
    if (isSessionWithDockviewLayout(sessionRef.current) && sessionRef.current.dockviewLayout) {
      try {
        rearrangingRef.current = true
        event.api.fromJSON(sessionRef.current.dockviewLayout)

        // Update params for restored panels
        for (const panel of event.api.panels) {
          panel.update({ params: { panelId: panel.id, session: sessionRef.current } })
        }

        // Track which views are already assigned
        for (const viewIds of sessionRef.current.panelViewAssignments.values()) {
          for (const viewId of viewIds) {
            trackedViewIdsRef.current.add(viewId)
          }
        }

        rearrangingRef.current = false
      } catch (e) {
        console.error('Failed to restore dockview layout:', e)
        rearrangingRef.current = false
        // Create initial panel on failure
        createInitialPanel(event.api)
      }
    } else {
      // Create initial panel
      createInitialPanel(event.api)
    }
  }

  const createInitialPanel = (dockviewApi: DockviewApi) => {
    const panelId = `panel-${nanoid()}`
    dockviewApi.addPanel({
      id: panelId,
      component: 'jbrowseView',
      tabComponent: 'jbrowseTab',
      title: 'Main',
      params: { panelId, session },
    })

    if (isSessionWithDockviewLayout(session)) {
      session.setActivePanelId(panelId)
    }
  }

  // Use autorun to react to MobX observable changes for views
  useEffect(() => {
    const dispose = autorun(() => {
      if (!api) {
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = trackedViewIdsRef.current

      // Add new views to the active panel
      views.forEach(view => {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)

          if (isSessionWithDockviewLayout(session)) {
            // Get the active panel, or create one if needed
            let activePanelId = session.activePanelId
            if (!activePanelId || !api.getPanel(activePanelId)) {
              // Use the first panel or create a new one
              const firstPanel = api.panels[0]
              if (firstPanel) {
                activePanelId = firstPanel.id
                session.setActivePanelId(activePanelId)
              } else {
                activePanelId = `panel-${nanoid()}`
                api.addPanel({
                  id: activePanelId,
                  component: 'jbrowseView',
                  tabComponent: 'jbrowseTab',
                  title: 'Main',
                  params: { panelId: activePanelId, session },
                })
                session.setActivePanelId(activePanelId)
              }
            }

            // Assign the view to the active panel
            session.assignViewToPanel(activePanelId, view.id)
          }
        }
      })

      // Remove views that no longer exist
      ;[...trackedIds].forEach(id => {
        if (!currentViewIds.has(id)) {
          trackedIds.delete(id)
          if (isSessionWithDockviewLayout(session)) {
            session.removeViewFromPanel(id)
          }
        }
      })
    })

    return () => {
      dispose()
    }
  }, [session, api])

  const themeClass =
    theme.palette.mode === 'dark'
      ? 'dockview-theme-dark'
      : 'dockview-theme-light'

  return (
    <DockviewContext.Provider value={contextValue}>
      <div className={`${classes.container} ${themeClass}`}>
        <DockviewReact
          components={components}
          tabComponents={tabComponents}
          leftHeaderActionsComponent={LeftHeaderActions}
          onReady={onReady}
        />
      </div>
    </DockviewContext.Provider>
  )
})

export default TiledViewsContainer
