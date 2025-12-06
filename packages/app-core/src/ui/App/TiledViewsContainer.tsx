import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import ViewWeekIcon from '@mui/icons-material/ViewWeek'
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed'
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import TabIcon from '@mui/icons-material/Tab'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
} from '@mui/material'
import { DockviewReact } from 'dockview-react'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

import { DockviewContext, useDockview } from './DockviewContext'
import JBrowseViewPanel, { JBrowseViewTab } from './JBrowseViewPanel'
import { isSessionWithDockviewLayout } from '../../DockviewLayout'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'
import type {
  DockviewApi,
  DockviewGroupPanel,
  DockviewReadyEvent,
  IDockviewHeaderActionsProps,
} from 'dockview-react'

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
  headerButton: {
    padding: 4,
    color: theme.palette.primary.contrastText,
  },
  headerIcon: {
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

function createPanelConfig(
  panelId: string,
  session: SessionType,
  title = 'Main',
) {
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

function updatePanelParams(api: DockviewApi, session: SessionType) {
  for (const panel of api.panels) {
    panel.update({ params: { panelId: panel.id, session } })
  }
}

function rearrangePanelsWithDirection(
  api: DockviewApi,
  getPosition: (
    idx: number,
    panelStates: { id: string }[],
  ) =>
    | { referencePanel: string; direction: 'right' | 'below' | 'within' }
    | undefined,
) {
  const panels = api.panels
  if (panels.length <= 1) {
    return
  }

  const panelStates = panels.map(p => ({
    id: p.id,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
    title: p.title,
    params: p.params,
  }))

  for (const p of panels) {
    api.removePanel(p)
  }
  for (const [idx, state] of panelStates.entries()) {
    api.addPanel({
      ...state,
      position: getPosition(idx, panelStates),
    })
  }
}

function LeftHeaderActions({
  containerApi,
  group,
}: IDockviewHeaderActionsProps) {
  const { classes } = useStyles()
  const { addEmptyTab } = useDockview()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSplit = (direction: 'right' | 'below') => {
    const newGroup = containerApi.addGroup({
      referenceGroup: group,
      direction,
    })
    addEmptyTab(newGroup)
    handleClose()
  }

  return (
    <div className={classes.headerActions}>
      <Tooltip title="Add tab">
        <IconButton
          size="small"
          onClick={e => {
            group.api.setActive()
            setAnchorEl(e.currentTarget)
          }}
          className={classes.headerButton}
        >
          <AddIcon className={classes.headerIcon} />
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
          <ListItemText>New empty split horizontal</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSplit('below')}>
          <ListItemIcon>
            <HorizontalSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New empty split vertical</ListItemText>
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
  const { rearrangePanels } = useDockview()

  const tileHorizontally = () => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'right' },
      )
    })
  }

  const tileVertically = () => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'below' },
      )
    })
  }

  const tileGrid = () => {
    rearrangePanels(api => {
      const panels = api.panels
      if (panels.length <= 1) {
        return
      }
      const cols = Math.ceil(Math.sqrt(panels.length))
      rearrangePanelsWithDirection(api, (idx, states) => {
        if (idx === 0) {
          return undefined
        }
        const col = idx % cols
        const row = Math.floor(idx / cols)
        if (col === 0) {
          const refIdx = (row - 1) * cols
          return { referencePanel: states[refIdx]!.id, direction: 'below' }
        }
        return { referencePanel: states[idx - 1]!.id, direction: 'right' }
      })
    })
  }

  const stackAll = () => {
    rearrangePanels(api => {
      rearrangePanelsWithDirection(api, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'within' },
      )
    })
  }

  const showLayoutOptions = containerApi.panels.length > 1
  const showCloseGroup = containerApi.groups.length > 1

  const layoutMenuItems = [
    {
      label: 'Global: change layout into set of tabs',
      icon: DynamicFeedIcon,
      onClick: stackAll,
    },
    {
      label: 'Global: tile horizontally',
      icon: ViewColumnIcon,
      onClick: tileHorizontally,
    },
    {
      label: 'Global: tile vertically',
      icon: TableRowsIcon,
      onClick: tileVertically,
    },
    {
      label: 'Global: tile grid',
      icon: ViewModuleIcon,
      onClick: tileGrid,
    },
  ]

  return (
    <div className={classes.headerActions}>
      {showLayoutOptions && (
        <CascadingMenuButton
          menuItems={layoutMenuItems}
          size="small"
          className={classes.headerButton}
        >
          <MoreHorizIcon className={classes.headerIcon} />
        </CascadingMenuButton>
      )}
      {showCloseGroup && (
        <Tooltip title="Close group">
          <IconButton
            size="small"
            onClick={() => {
              for (const panel of group.panels) {
                panel.api.close()
              }
            }}
            className={classes.headerButton}
          >
            <CloseIcon className={classes.headerIcon} />
          </IconButton>
        </Tooltip>
      )}
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

  const addEmptyTab = useCallback(
    (targetGroup?: DockviewGroupPanel) => {
      if (!api) {
        return
      }
      const panelId = `panel-${nanoid()}`
      const group = targetGroup ?? api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: group ? { referenceGroup: group } : undefined,
      })

      if (isSessionWithDockviewLayout(session)) {
        session.setActivePanelId(panelId)
      }
    },
    [api, session],
  )

  const moveViewToNewTab = useCallback(
    (viewId: string) => {
      if (!api || !isSessionWithDockviewLayout(session)) {
        return
      }
      // Remove view from current panel
      session.removeViewFromPanel(viewId)

      // Create new panel and assign the view to it
      const panelId = `panel-${nanoid()}`
      const group = api.activeGroup
      api.addPanel({
        ...createPanelConfig(panelId, session, 'New Tab'),
        position: group ? { referenceGroup: group } : undefined,
      })
      session.assignViewToPanel(panelId, viewId)
      session.setActivePanelId(panelId)
    },
    [api, session],
  )

  const contextValue = useMemo(
    () => ({ api, rearrangePanels, addEmptyTab, moveViewToNewTab }),
    [api, rearrangePanels, addEmptyTab, moveViewToNewTab],
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
          updatePanelParams(event.api, sessionRef.current)

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
        updatePanelParams(api, sessionRef.current)

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
