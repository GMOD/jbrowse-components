import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
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
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewHeaderActionsProps,
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
  closeButton: {
    padding: 4,
    color: theme.palette.primary.contrastText,
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
  },
  closeIcon: {
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

const components = {
  jbrowseView: JBrowseViewPanel,
}

const tabComponents = {
  jbrowseTab: JBrowseViewTab,
}

function createPanelConfig(panelId: string, session: SessionType, title = 'Main') {
  return {
    id: panelId,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
    title,
    params: { panelId, session },
  }
}

function cleanLayoutForStorage(layout: ReturnType<DockviewApi['toJSON']>) {
  return {
    ...layout,
    panels: Object.fromEntries(
      Object.entries(layout.panels).map(([id, panel]) => [
        id,
        { ...panel, params: {} },
      ]),
    ),
  }
}

function LeftHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const { classes } = useStyles()
  const { addEmptyTab } = useDockview()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClose = () => setAnchorEl(null)

  const handleSplit = (direction: 'right' | 'below') => {
    const activePanel = group.activePanel
    if (activePanel) {
      activePanel.api.moveTo({
        group: containerApi.addGroup({
          referenceGroup: group,
          direction,
        }),
      })
    }
    handleClose()
  }

  return (
    <div className={classes.headerActions}>
      <Tooltip title="Layout options">
        <IconButton
          size="small"
          onClick={e => {
            group.api.setActive()
            setAnchorEl(e.currentTarget)
          }}
          className={classes.addButton}
        >
          <AddIcon className={classes.addIcon} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <MenuItem
          onClick={() => {
            addEmptyTab()
            handleClose()
          }}
        >
          <ListItemIcon>
            <TabIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New empty tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSplit('right')}>
          <ListItemIcon>
            <VerticalSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Split right</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSplit('below')}>
          <ListItemIcon>
            <HorizontalSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Split down</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  )
}

function RightHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const { classes } = useStyles()

  if (containerApi.groups.length <= 1) {
    return null
  }

  return (
    <div className={classes.headerActions}>
      <Tooltip title="Close group">
        <IconButton
          size="small"
          onClick={() => {
            for (const panel of [...group.panels]) {
              panel.api.close()
            }
          }}
          className={classes.closeButton}
        >
          <CloseIcon className={classes.closeIcon} />
        </IconButton>
      </Tooltip>
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
    const panelId = `panel-${nanoid()}`
    api.addPanel({
      ...createPanelConfig(panelId, session, 'New Tab'),
      position: api.activeGroup ? { referenceGroup: api.activeGroup } : undefined,
    })

    if (isSessionWithDockviewLayout(session)) {
      session.setActivePanelId(panelId)
    }
  }, [api, session])

  const contextValue = useMemo(
    () => ({ api, rearrangePanels, addEmptyTab }),
    [api, rearrangePanels, addEmptyTab],
  )

  const createInitialPanel = useCallback((dockviewApi: DockviewApi) => {
    const panelId = `panel-${nanoid()}`
    dockviewApi.addPanel(createPanelConfig(panelId, sessionRef.current))

    if (isSessionWithDockviewLayout(sessionRef.current)) {
      sessionRef.current.setActivePanelId(panelId)
    }
  }, [])

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api)

      event.api.onDidActivePanelChange(e => {
        if (e?.id && isSessionWithDockviewLayout(sessionRef.current)) {
          sessionRef.current.setActivePanelId(e.id)
        }
      })

      event.api.onDidRemovePanel(e => {
        if (rearrangingRef.current) {
          return
        }
        if (isSessionWithDockviewLayout(sessionRef.current)) {
          const viewIds = sessionRef.current.getViewIdsForPanel(e.id)
          for (const viewId of viewIds) {
            const view = sessionRef.current.views.find(v => v.id === viewId)
            if (view) {
              sessionRef.current.removeView(view)
            }
          }
          sessionRef.current.removePanel(e.id)
        }
      })

      event.api.onDidLayoutChange(() => {
        if (
          !rearrangingRef.current &&
          isSessionWithDockviewLayout(sessionRef.current)
        ) {
          sessionRef.current.setDockviewLayout(
            cleanLayoutForStorage(event.api.toJSON()),
          )
        }
      })

      if (
        isSessionWithDockviewLayout(sessionRef.current) &&
        sessionRef.current.dockviewLayout
      ) {
        try {
          rearrangingRef.current = true
          event.api.fromJSON(sessionRef.current.dockviewLayout)

          for (const panel of event.api.panels) {
            panel.update({
              params: { panelId: panel.id, session: sessionRef.current },
            })
          }

          for (const viewIds of sessionRef.current.panelViewAssignments.values()) {
            for (const viewId of viewIds) {
              trackedViewIdsRef.current.add(viewId)
            }
          }

          rearrangingRef.current = false
        } catch (e) {
          console.error('Failed to restore dockview layout:', e)
          rearrangingRef.current = false
          createInitialPanel(event.api)
        }
      } else {
        createInitialPanel(event.api)
      }
    },
    [createInitialPanel],
  )

  useEffect(() => {
    const dispose = autorun(() => {
      if (!api) {
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = trackedViewIdsRef.current

      for (const view of views) {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)

          if (isSessionWithDockviewLayout(session)) {
            let activePanelId = session.activePanelId
            if (!activePanelId || !api.getPanel(activePanelId)) {
              const firstPanel = api.panels[0]
              if (firstPanel) {
                activePanelId = firstPanel.id
              } else {
                activePanelId = `panel-${nanoid()}`
                api.addPanel(createPanelConfig(activePanelId, session))
              }
              session.setActivePanelId(activePanelId)
            }
            session.assignViewToPanel(activePanelId, view.id)
          }
        }
      }

      for (const id of trackedIds) {
        if (!currentViewIds.has(id)) {
          trackedIds.delete(id)
          if (isSessionWithDockviewLayout(session)) {
            session.removeViewFromPanel(id)
          }
        }
      }
    })

    return dispose
  }, [session, api])

  // React to layout changes from undo/redo
  useEffect(() => {
    if (!api || !isSessionWithDockviewLayout(session)) {
      return
    }

    const dispose = autorun(() => {
      const { dockviewLayout } = session
      if (!dockviewLayout || rearrangingRef.current) {
        return
      }

      // Compare current dockview state with session state
      const currentLayout = cleanLayoutForStorage(api.toJSON())
      if (JSON.stringify(currentLayout) === JSON.stringify(dockviewLayout)) {
        return
      }

      // Layout differs - restore from session (likely from undo/redo)
      rearrangingRef.current = true
      try {
        api.fromJSON(dockviewLayout)

        for (const panel of api.panels) {
          panel.update({
            params: { panelId: panel.id, session: sessionRef.current },
          })
        }

        // Rebuild tracked view IDs from restored layout
        trackedViewIdsRef.current.clear()
        for (const viewIds of session.panelViewAssignments.values()) {
          for (const viewId of viewIds) {
            trackedViewIdsRef.current.add(viewId)
          }
        }
      } catch (e) {
        console.error('Failed to restore dockview layout from undo:', e)
      } finally {
        rearrangingRef.current = false
      }
    })

    return dispose
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
          rightHeaderActionsComponent={RightHeaderActions}
          onReady={onReady}
        />
      </div>
    </DockviewContext.Provider>
  )
})

export default TiledViewsContainer
