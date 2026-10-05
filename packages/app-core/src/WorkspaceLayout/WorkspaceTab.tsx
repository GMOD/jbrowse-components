import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputBase, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import JBrowseTabMenu from '../ui/App/JBrowseTabMenu.tsx'
import { tabDisplayName } from './tabName.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'
import type { TabNode } from './tree.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  // the `[role=tab]` wrapper in TabStrip owns background and selected state
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
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
  /** closes the tab and the views it holds */
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const title = tabDisplayName(tab, views, session)

  const startEditing = () => {
    setDraft(title)
    setEditing(true)
  }

  // an empty box or the unchanged automatic name keeps the name automatic
  const save = () => {
    const name = draft.trim()
    const automatic = tabDisplayName(
      { ...tab, title: undefined },
      views,
      session,
    )
    layout.renameTab(tab.id, name && name !== automatic ? name : undefined)
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
            e.stopPropagation()
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
            onDoubleClick={startEditing}
          >
            {title}
          </Typography>
          <JBrowseTabMenu onRename={startEditing} onClose={onClose} />
        </>
      )}
    </div>
  )
})
