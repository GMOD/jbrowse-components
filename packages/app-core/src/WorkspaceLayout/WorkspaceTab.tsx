import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputBase, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowseTabMenu from '../ui/App/JBrowseTabMenu.tsx'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
import type { TabNode } from './tree.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  // Only the label and its menu. The background, the selected state and the
  // hover live on the strip's own `[role=tab]` wrapper, which is where the
  // selection is known — two places styling one tab is how they drift.
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  // dockview's `.dv-default-tab-content`: takes the space, truncates with an
  // ellipsis, and takes its colour from the tab, which is what encodes
  // active/inactive
  title: {
    flexGrow: 1,
    marginRight: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 'inherit',
    color: 'inherit',
  },
  editInput: {
    fontSize: 'inherit',
    padding: '2px 4px',
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
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
  session: WorkspaceSessionType,
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
  onClose,
}: {
  tab: TabNode
  views: AbstractViewModel[]
  session: WorkspaceSessionType
  layout: WorkspaceLayout
  /**
   * Closing a tab closes the views it held, and the layout does not own views —
   * so the pair is one function at the call site rather than spelled out here.
   * The strip's middle-click needs the same pair, and two spellings of "and
   * also remove the views" is how one of them comes to be missing it.
   */
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const title = tabDisplayName(tab, views, session)

  const save = () => {
    // An empty box means "go back to the automatic name". `title === undefined`
    // is the sentinel for "not renamed" and `renameTab` takes it, but nothing
    // in the UI passed it: clearing the box just discarded the edit, so a
    // rename could be made and never unmade.
    layout.renameTab(tab.id, draft.trim() || undefined)
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
            onClose={onClose}
          />
        </>
      )}
    </div>
  )
})
