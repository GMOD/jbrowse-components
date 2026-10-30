import { queryParamsHref } from '@jbrowse/app-core'
import { formatRelativeTime } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { IconButton, Link, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../../sessionThumbnail.ts'

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
  thumbnail?: string
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
    lineHeight: 1.4,
  },
  detail: {
    color: theme.palette.text.secondary,
    fontSize: '0.85em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    minWidth: 0,
  },
  thumbnail: {
    display: 'block',
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    objectFit: 'cover',
    objectPosition: 'top left',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    background: theme.palette.background.default,
  },
}))

// The open session is not offered as a link: re-opening it from IndexedDB can
// only lose work, since that row is up to one autosave tick behind the live
// model. A real href otherwise, so a modified or middle click opens the session
// in a new tab the way any link does; a plain click switches this tab in place.
const SessionLink = observer(function SessionLink({
  row,
  session,
  children,
}: CellProps & { children: React.ReactNode }) {
  return row.current ? (
    children
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
      {children}
    </Link>
  )
})

export const ThumbnailCell = observer(function ThumbnailCell({
  row,
  session,
}: CellProps) {
  const { classes } = useStyles()
  return (
    <div className={classes.cell}>
      <SessionLink row={row} session={session}>
        {row.thumbnail ? (
          <img className={classes.thumbnail} src={row.thumbnail} alt="" />
        ) : (
          <div className={classes.thumbnail} />
        )}
      </SessionLink>
    </div>
  )
})

// A native `title`, not a MUI Tooltip: the drawer is narrow enough that a long
// session name ellipses, and a tooltip here would mean a popper laid over the
// row underneath — which is exactly how this column lost its clicks once
// already (see the scrollbar note in SessionManager's useStyles). Last use leads
// the second line, so the ellipsis eats the summary rather than the date.
export const NameCell = observer(function NameCell({
  row,
  session,
}: CellProps) {
  const { classes } = useStyles()
  const lastUsed = formatRelativeTime(row.lastUsed)
  const title = [
    row.label,
    row.summary,
    `Last used ${row.lastUsed.toLocaleString()}`,
    `Created ${row.createdAt.toLocaleString()}`,
  ]
    .filter(Boolean)
    .join('\n')
  return (
    <div className={classes.cell} title={title}>
      <div className={classes.name}>
        <SessionLink row={row} session={session}>
          {row.label}
        </SessionLink>
      </div>
      <div className={classes.detail}>
        {row.summary ? `${lastUsed} · ${row.summary}` : lastUsed}
      </div>
    </div>
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
