import { Suspense, lazy, useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { InputBase, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer'
import { isSessionWithDockviewLayout } from '../../DockviewLayout'

import type { DockviewSessionType } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'
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
  tabIcons: {
    display: 'flex',
    alignItems: 'center',
    visibility: 'hidden',
  },
  tabIconsVisible: {
    visibility: 'visible',
  },
  tabIcon: {
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

export interface JBrowseViewPanelParams {
  panelId: string
  session?: DockviewSessionType
}

function stopEvent(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
}

function getViewsForPanel(
  panelId: string,
  session: DockviewSessionType | undefined,
): AbstractViewModel[] {
  if (!session || !isSessionWithDockviewLayout(session)) {
    return []
  }
  const viewIds = session.getViewIdsForPanel(panelId)
  return [...viewIds]
    .map(id => session.views.find(v => v.id === id))
    .filter((v): v is AbstractViewModel => v !== undefined)
}

function getTabDisplayName(
  views: AbstractViewModel[],
  session: DockviewSessionType,
) {
  if (views.length === 0) {
    return 'Empty'
  }
  if (views.length === 1) {
    const view = views[0]!
    return (
      view.displayName ||
      // @ts-expect-error
      view.assemblyNames
        // @ts-expect-error
        ?.map(r => session.assemblyManager.get(r)?.displayName)
        .join(',') ||
      'View'
    )
  }
  return `${views.length} views`
}

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  params,
}: IDockviewPanelProps<JBrowseViewPanelParams>) {
  const { panelId, session } = params
  const { classes } = useStyles()

  if (!session) {
    return <div className={classes.container}>Loading...</div>
  }

  const views = getViewsForPanel(panelId, session)

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

function TabMenu({
  isHovered,
  onRename,
  onClose,
}: {
  isHovered: boolean
  onRename: () => void
  onClose: () => void
}) {
  const { classes } = useStyles()
  const menuItems = [
    {
      label: 'Rename tab',
      icon: EditIcon,
      onClick: onRename,
    },
    {
      label: 'Close tab',
      icon: CloseIcon,
      onClick: onClose,
    },
  ]

  return (
    <div
      className={`${classes.tabIcons} ${isHovered ? classes.tabIconsVisible : ''}`}
    >
      <CascadingMenuButton
        menuItems={menuItems}
        size="small"
        className={classes.tabIcon}
        stopPropagation
      >
        <MoreVertIcon className={classes.smallIcon} />
      </CascadingMenuButton>
    </div>
  )
}

export const JBrowseViewTab = observer(function JBrowseViewTab({
  params,
  api,
}: IDockviewPanelHeaderProps<JBrowseViewPanelParams>) {
  const { panelId, session } = params
  const { classes } = useStyles()
  const [isEditing, setIsEditing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [editValue, setEditValue] = useState('')

  if (!session) {
    return (
      <div className={classes.tabContainer}>
        <span className={classes.tabTitleText}>Loading...</span>
      </div>
    )
  }

  const views = getViewsForPanel(panelId, session)
  const displayValue = getTabDisplayName(views, session)

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
            onFocus={e => {
              e.target.select()
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={stopEvent}
          />
        ) : (
          <>
            <Typography
              className={classes.tabTitleText}
              variant="body2"
              onDoubleClick={handleStartEdit}
            >
              {api.title || displayValue}
            </Typography>
            <TabMenu
              isHovered={isHovered}
              onRename={handleStartEdit}
              onClose={() => {
                api.close()
              }}
            />
          </>
        )}
      </div>
    </div>
  )
})

export default JBrowseViewPanel
