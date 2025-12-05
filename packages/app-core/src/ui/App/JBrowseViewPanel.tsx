import { Suspense, useState } from 'react'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv, getSession, useWidthSetter } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import { IconButton, InputBase, Paper, Tooltip, Typography, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import ViewMenu from './ViewMenu'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { IDockviewPanelHeaderProps, IDockviewPanelProps } from 'dockview-react'
import type {
  AbstractViewContainer,
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    overflow: 'auto',
    background: theme.palette.background.default,
  },
  content: {
    padding: theme.spacing(1),
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
  menuIcon: {
    color: 'inherit',
    padding: 2,
  },
}))

export interface JBrowseViewPanelParams {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets & AbstractViewContainer
}

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  params,
}: IDockviewPanelProps<JBrowseViewPanelParams>) {
  const { view, session } = params
  const { classes } = useStyles()
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)

  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }

  const { ReactComponent } = viewType

  return (
    <Paper ref={ref} elevation={0} className={classes.container}>
      <div className={classes.content}>
        {!view.minimized ? (
          <ErrorBoundary
            FallbackComponent={({ error }) => <ErrorMessage error={error} />}
          >
            <Suspense fallback={<LoadingEllipses variant="h6" />}>
              <ReactComponent model={view} session={session} />
            </Suspense>
          </ErrorBoundary>
        ) : null}
      </div>
    </Paper>
  )
})

export const JBrowseViewTab = observer(function JBrowseViewTab({
  params,
  api,
}: IDockviewPanelHeaderProps<JBrowseViewPanelParams>) {
  const { view } = params
  const { classes } = useStyles()
  const session = getSession(view)
  const { assemblyManager } = session
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [editValue, setEditValue] = useState('')

  const displayValue =
    view.displayName ||
    // @ts-expect-error
    view.assemblyNames?.map(r => assemblyManager.get(r)?.displayName).join(',') ||
    'Untitled view'

  const handleStartEdit = () => {
    setEditValue(displayValue)
    setIsEditing(true)
  }

  const handleSave = () => {
    if (editValue.trim()) {
      view.setDisplayName(editValue.trim())
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ViewMenu
        model={view as IBaseViewModel}
        IconButtonProps={{ className: classes.menuIcon, size: 'small' }}
        IconProps={{ fontSize: 'small' }}
      />
      <div className={classes.tabTitle}>
        {isEditing ? (
          <InputBase
            autoFocus
            className={classes.editInput}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <>
            <Typography className={classes.tabTitleText} variant="body2">
              {displayValue}
            </Typography>
            {isHovered && (
              <>
                <Tooltip title="Rename view">
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
                <Tooltip title="Close view">
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
