import { Suspense, lazy, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, InputBase, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer'
import { isSessionWithDockviewLayout } from '../../DockviewLayout'

import type {
  AbstractViewContainer,
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'
import type {
  IDockviewPanelHeaderProps,
  IDockviewPanelProps,
} from 'dockview-react'

const ViewLauncher = lazy(() => import('./ViewLauncher'))

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    overflowY: 'auto',
    background: theme.palette.background.default,
  },
  viewStack: {
    display: 'flex',
    flexDirection: 'column',
  },
  spacer: {
    height: 300,
  },
  tabContainer: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    padding: '0 4px',
    gap: 4,
  },
  tabTitle: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden',
    minWidth: 0,
  },
  tabTitleText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.8rem',
  },
  editIcon: {
    padding: 2,
    marginLeft: 2,
    color: 'inherit',
  },
  closeIcon: {
    padding: 2,
    marginLeft: 2,
    color: 'inherit',
  },
  smallIcon: {
    fontSize: 14,
  },
  editInput: {
    fontSize: '0.8rem',
    padding: '2px 4px',
    color: 'inherit',
    backgroundColor: theme.palette.action.selected,
    borderRadius: theme.shape.borderRadius,
    flex: 1,
  },
  emptyPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
}))

type SessionType = SessionWithFocusedViewAndDrawerWidgets &
  AbstractViewContainer

export interface JBrowseViewPanelParams {
  panelId: string
  session: SessionType
}

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  params,
}: IDockviewPanelProps<JBrowseViewPanelParams>) {
  const { panelId, session } = params
  const { classes } = useStyles()

  // Session may be undefined during layout restoration (before params are updated)
  if (!session) {
    return <div className={classes.container}>Loading...</div>
  }

  // Get view IDs assigned to this panel
  let viewIds: string[] = []
  if (isSessionWithDockviewLayout(session)) {
    viewIds = [...session.getViewIdsForPanel(panelId)]
  }

  // Map view IDs to actual view objects
  const views = viewIds
    .map(id => session.views.find(v => v.id === id))
    .filter((v): v is AbstractViewModel => v !== undefined)

  if (views.length === 0) {
    return (
      <div className={classes.container}>
        <div className={classes.emptyPanel}>
          <Suspense fallback={null}>
            <ViewLauncher session={session} />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.container}>
      <div className={classes.viewStack}>
        {views.map(view => (
          <ViewContainer key={view.id} view={view} session={session} />
        ))}
        <div className={classes.spacer} />
      </div>
    </div>
  )
})

export const JBrowseViewTab = observer(function JBrowseViewTab({
  params,
  api,
}: IDockviewPanelHeaderProps<JBrowseViewPanelParams>) {
  const { panelId, session } = params
  const { classes } = useStyles()
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [editValue, setEditValue] = useState('')

  // Session may be undefined during layout restoration
  if (!session) {
    return (
      <div className={classes.tabContainer}>
        <span className={classes.tabTitleText}>Loading...</span>
      </div>
    )
  }

  // Get view IDs assigned to this panel
  let viewIds: string[] = []
  if (isSessionWithDockviewLayout(session)) {
    viewIds = [...session.getViewIdsForPanel(panelId)]
  }

  // Generate display name based on views in the panel
  let displayValue = 'Empty'
  if (viewIds.length === 1) {
    const view = session.views.find(v => v.id === viewIds[0])
    if (view) {
      displayValue =
        view.displayName ||
        // @ts-expect-error
        view.assemblyNames
          // @ts-expect-error
          ?.map(r => session.assemblyManager.get(r)?.displayName)
          .join(',') ||
        'View'
    }
  } else if (viewIds.length > 1) {
    displayValue = `${viewIds.length} views`
  }

  const handleStartEdit = () => {
    setEditValue(api.title || displayValue)
    setIsEditing(true)
  }

  const handleSave = () => {
    if (editValue.trim()) {
      api.setTitle(editValue.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    api.close()
  }

  return (
    <div
      className={classes.tabContainer}
      onMouseEnter={() => {
        setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
      }}
    >
      <div className={classes.tabTitle}>
        {isEditing ? (
          <InputBase
            autoFocus
            className={classes.editInput}
            value={editValue}
            onChange={e => {
              setEditValue(e.target.value)
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={e => {
              e.stopPropagation()
            }}
          />
        ) : (
          <>
            <Typography className={classes.tabTitleText} variant="body2">
              {api.title || displayValue}
            </Typography>
            {isHovered && (
              <>
                <Tooltip title="Rename tab">
                  <IconButton
                    className={classes.editIcon}
                    size="small"
                    onClick={e => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleStartEdit()
                    }}
                    onMouseDown={e => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onPointerDown={e => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                  >
                    <EditIcon className={classes.smallIcon} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close tab">
                  <IconButton
                    className={classes.closeIcon}
                    size="small"
                    onClick={handleClose}
                    onMouseDown={e => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    onPointerDown={e => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                  >
                    <CloseIcon className={classes.smallIcon} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
})

export default JBrowseViewPanel
