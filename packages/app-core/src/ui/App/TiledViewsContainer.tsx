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
  const viewIdsRef = useRef<Set<string>>(new Set())
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
    const emptyPanelId = `empty-${nanoid()}`
    api.addPanel({
      id: emptyPanelId,
      component: 'emptyPanel',
      title: 'New Tab',
      params: { session },
      position: activeGroup ? { referenceGroup: activeGroup } : undefined,
    })
  }, [api, session])

  const contextValue = useMemo(
    () => ({ api, rearrangePanels, addEmptyTab }),
    [api, rearrangePanels, addEmptyTab],
  )

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event.api)

    // Handle panel activation to sync focus
    event.api.onDidActivePanelChange(e => {
      if (e?.id) {
        sessionRef.current.setFocusedViewId?.(e.id)
      }
    })

    // Handle panel removal from dockview UI (close button)
    event.api.onDidRemovePanel(e => {
      if (rearrangingRef.current) {
        return
      }
      const panelId = e.id
      // Skip empty panels - they don't have corresponding views
      if (panelId.startsWith('empty-')) {
        return
      }
      viewIdsRef.current.delete(panelId)
      const view = sessionRef.current.views.find(v => v.id === panelId)
      if (view) {
        sessionRef.current.removeView(view)
      }
    })
  }

  // Use autorun to react to MobX observable changes
  useEffect(() => {
    const dispose = autorun(() => {
      if (!api) {
        return
      }

      const { views } = session
      const currentViewIds = new Set(views.map(v => v.id))
      const trackedIds = viewIdsRef.current

      // Add new views to the active group (as tabs), or create first panel
      views.forEach((view, idx) => {
        if (!trackedIds.has(view.id)) {
          trackedIds.add(view.id)
          const activeGroup = api.activeGroup

          // Find and remove any empty panel in the active group
          if (activeGroup) {
            const emptyPanel = activeGroup.panels.find(p =>
              p.id.startsWith('empty-'),
            )
            if (emptyPanel) {
              rearrangingRef.current = true
              api.removePanel(emptyPanel)
              rearrangingRef.current = false
            }
          }

          api.addPanel({
            id: view.id,
            component: 'jbrowseView',
            tabComponent: 'jbrowseTab',
            title: view.displayName || `View ${idx + 1}`,
            params: { view, session },
            // Use referenceGroup without direction to add as a tab in the same group
            position: activeGroup ? { referenceGroup: activeGroup } : undefined,
          })
        }
      })

      // Remove views that no longer exist (removed via session.removeView)
      ;[...trackedIds].forEach(id => {
        if (!currentViewIds.has(id)) {
          trackedIds.delete(id)
          const panel = api.getPanel(id)
          if (panel) {
            rearrangingRef.current = true
            api.removePanel(panel)
            rearrangingRef.current = false
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
