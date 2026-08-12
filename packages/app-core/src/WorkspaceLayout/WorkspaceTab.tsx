import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputBase, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowseTabMenu from '../ui/App/JBrowseTabMenu.tsx'

import type { DockviewSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
import type { TabNode } from './tree.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',
    gap: 4,
    maxWidth: 240,
    borderRight: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    '&[aria-selected="true"]': {
      background: theme.palette.action.selected,
    },
    '&:hover .jbrowse-tab-menu': {
      visibility: 'visible',
    },
  },
  title: {
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

/**
 * A tab's name is **derived** from the views it holds, unless the user set one.
 *
 * `title === undefined` is the sentinel for "not renamed", which is a plain
 * `maybe` on the tab rather than the comparison the dockview version needed:
 * dockview restores an unset title as the panel id, so telling a real title
 * from a restored one meant testing `title !== panelId` and hoping nobody named
 * a tab after a panel.
 */
export function tabDisplayName(
  tab: TabNode,
  views: AbstractViewModel[],
  session: DockviewSessionType,
) {
  if (tab.title) {
    return tab.title
  }
  if (views.length === 0) {
    return 'Empty'
  }
  if (views.length === 1) {
    const view = views[0]!
    return (
      view.displayName ||
      view.assemblyNames
        ?.map(r => session.assemblyManager.getDisplayName(r))
        .join(',') ||
      'View'
    )
  }
  return `${views.length} views`
}

export const WorkspaceTab = observer(function WorkspaceTab({
  tab,
  views,
  session,
  layout,
}: {
  tab: TabNode
  views: AbstractViewModel[]
  session: DockviewSessionType
  layout: WorkspaceLayout
}) {
  const { classes } = useStyles()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const title = tabDisplayName(tab, views, session)

  const save = () => {
    if (draft.trim()) {
      layout.renameTab(tab.id, draft.trim())
    }
    setEditing(false)
  }

  return (
    <div className={classes.tab}>
      {editing ? (
        <InputBase
          autoFocus
          className={classes.editInput}
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
          }}
          onFocus={e => {
            e.target.select()
          }}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              save()
            } else if (e.key === 'Escape') {
              setEditing(false)
            }
          }}
          // the tab strip starts a drag on pointerdown; renaming must not
          onPointerDown={e => {
            e.stopPropagation()
          }}
          onClick={e => {
            e.stopPropagation()
          }}
        />
      ) : (
        <>
          <Typography
            className={classes.title}
            variant="body2"
            onDoubleClick={() => {
              setDraft(title)
              setEditing(true)
            }}
          >
            {title}
          </Typography>
          <JBrowseTabMenu
            onRename={() => {
              setDraft(title)
              setEditing(true)
            }}
            onClose={() => {
              // closing a tab closes the views it held, same as before
              for (const view of views) {
                session.removeView(view)
              }
              layout.closeTab(tab.id)
            }}
          />
        </>
      )}
    </div>
  )
})
