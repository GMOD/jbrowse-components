import { ActionLink } from '@jbrowse/core/ui'
import { formatRelativeTime } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionModel } from './util.ts'

/**
 * One row of the saved-session grid. `current` is precomputed rather than
 * re-derived per cell: two cells turn on it, and it is the fact that decides
 * what each of them is allowed to do (see DeleteCell).
 */
export interface Row {
  id: string
  name: string
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

export const NameCell = observer(function NameCell({
  row,
  session,
}: CellProps) {
  // the open session is not offered as a link: re-opening it from IndexedDB can
  // only lose work, since that row is up to one autosave tick behind the live
  // model. The File menu leaves it out of the recent list for the same reason.
  return row.current ? (
    <span>{row.name} (current)</span>
  ) : (
    <ActionLink
      onClick={() => {
        void session.activateSession(row.id)
      }}
    >
      {row.name}
    </ActionLink>
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
