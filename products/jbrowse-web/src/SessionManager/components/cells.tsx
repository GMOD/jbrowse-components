import { queryParamsHref } from '@jbrowse/app-core'
import { formatRelativeTime } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { IconButton, Link, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionModel } from './util.ts'

/**
 * One row of the saved-session grid. `current` is precomputed rather than
 * re-derived per cell: two cells turn on it, and it is the fact that decides
 * what each of them is allowed to do (see DeleteCell).
 */
export interface Row {
  id: string
  /** the editable value — what a rename writes, never what the cell draws */
  name: string
  /** what the name cell draws: `name`, plus "(current)" on the open session */
  label: string
  /** what the session holds, e.g. "hg38 · 2 views · 14 tracks" */
  summary?: string
  createdAt: Date
  lastUsed: Date
  fav: boolean
  current: boolean
}

interface CellProps {
  row: Row
  session: SessionModel
}

// Every icon-only control here carries the same string as its tooltip and its
// aria-label. Without the label a screen reader announces an unnamed button per
// row; without the tooltip a sighted user has to guess what the icon deletes.
const IconCell = observer(function IconCell({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactElement
}) {
  return (
    <Tooltip disableInteractive title={label}>
      {/* span so the tooltip still fires over a disabled button */}
      <span>
        <IconButton aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
})

export const FavoriteCell = observer(function FavoriteCell({
  row,
  session,
}: CellProps) {
  return (
    <IconCell
      label={row.fav ? 'Remove from favorites' : 'Add to favorites'}
      onClick={() => {
        void session.setSavedSessionFavorite(row.id, !row.fav)
      }}
    >
      {row.fav ? <StarIcon /> : <StarBorderIcon />}
    </IconCell>
  )
})

const useStyles = makeStyles()(theme => ({
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  summary: {
    color: theme.palette.text.secondary,
  },
}))

export const NameCell = observer(function NameCell({
  row,
  session,
}: CellProps) {
  const { classes } = useStyles()
  // A native `title`, not a MUI Tooltip: the drawer is narrow enough that a
  // long session name ellipses, and a tooltip here would mean a popper laid
  // over the row underneath — which is exactly how this column lost its clicks
  // once already (see the scrollbar note in SessionManager's useStyles).
  //
  // The open session is not offered as a link: re-opening it from IndexedDB can
  // only lose work, since that row is up to one autosave tick behind the live
  // model. The File menu leaves it out of the recent list for the same reason.
  //
  // A real href, so a modified or middle click opens the session in a new tab
  // the way any link does; a plain click switches this tab in place.
  const title = row.summary ? `${row.label}\n${row.summary}` : row.label
  return (
    <div className={classes.name} title={title}>
      {row.current ? (
        row.label
      ) : (
        <Link
          href={queryParamsHref({ session: `local-${row.id}` })}
          onClick={event => {
            if (
              event.button === 0 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault()
              void session.activateSession(row.id)
            }
          }}
        >
          {row.label}
        </Link>
      )}
      {row.summary ? (
        <span className={classes.summary}> · {row.summary}</span>
      ) : null}
    </div>
  )
})

// dated by last use, not creation: the rows arrive ordered by last use, so
// showing createdAt would read as an unsorted list. Both are in the tooltip,
// since an id survives reloads and the gap between them is often large.
export const LastUsedCell = observer(function LastUsedCell({ row }: CellProps) {
  return (
    <Tooltip
      disableInteractive
      slotProps={{ transition: { timeout: 0 } }}
      title={`Last used ${row.lastUsed.toLocaleString()}\nCreated ${row.createdAt.toLocaleString()}`}
    >
      <div>{formatRelativeTime(row.lastUsed)}</div>
    </Tooltip>
  )
})

export const DeleteCell = observer(function DeleteCell({
  row,
  session,
}: CellProps) {
  // the open session is rewritten by the autosave autorun every 400ms, so
  // deleting it only makes it vanish until the next edit puts it back — say so
  // on a disabled button rather than on a snackbar after the click
  return (
    <IconCell
      label={
        row.current
          ? 'Cannot delete the session that is currently open'
          : `Delete session ${row.name}`
      }
      disabled={row.current}
      onClick={() => {
        void session.deleteSavedSession(row.id)
      }}
    >
      <DeleteIcon />
    </IconCell>
  )
})
