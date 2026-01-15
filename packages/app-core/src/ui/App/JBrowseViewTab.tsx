import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputBase, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowseTabMenu from './JBrowseTabMenu.tsx'
import { getViewsForPanel } from './dockviewUtils.ts'

import type { DockviewSessionType } from './types.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { IDockviewPanelHeaderProps } from 'dockview-react'

const useStyles = makeStyles()(theme => ({
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

  editInput: {
    fontSize: '0.8rem',
    padding: '2px 4px',
    color: 'inherit',
    backgroundColor: theme.palette.action.selected,
    borderRadius: theme.shape.borderRadius,
    flex: 1,
  },
}))

function stopEvent(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
}

export interface JBrowseViewPanelParams {
  panelId: string
  session?: DockviewSessionType
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

const JBrowseViewTab = observer(function JBrowseViewTab({
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
            <JBrowseTabMenu
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
export default JBrowseViewTab
