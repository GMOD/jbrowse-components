import { useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LabeledCheckbox,
} from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { mutate, useFetch } from '@jbrowse/core/util/useFetch'
import DeleteIcon from '@mui/icons-material/Delete'
import ListIcon from '@mui/icons-material/List'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import {
  FormControl,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { observer } from 'mobx-react'

import { invokeIpc } from '../../../ipc.ts'
import { useNotifyError } from '../../NotifyContext.ts'
import {
  LIST_SESSIONS_KEY,
  removeRecentAction,
} from '../../removeRecentAction.ts'
import DeleteSessionDialog from '../dialogs/DeleteSessionDialog.tsx'
import RenameDialog from '../dialogs/RenameDialog.tsx'
import { COMPACT_QUERY, NARROW_QUERY } from '../narrow.ts'
import { useStartScreenLaunch } from '../startScreenLaunch.ts'
import { useInnerDims } from '../useInnerDims.ts'
import { loadPluginManager } from '../util.tsx'
import RecentSessionsCards from './RecentSessionsCards.tsx'
import RecentSessionsDataGrid from './RecentSessionsDataGrid.tsx'
import { useFavoriteSessions } from './useFavoriteSessions.ts'

import type { RecentSessionData } from '../types.ts'
import type { ToggleButtonProps } from '@mui/material'

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    // a narrow panel used to crush the row's items below their content width;
    // let them spill onto a second line instead
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  label: {
    whiteSpace: 'nowrap',
  },
})

type RecentSessions = RecentSessionData[]

const ToggleButtonWithTooltip = observer(function ToggleButtonWithTooltip({
  title = '',
  children,
  ...rest
}: ToggleButtonProps) {
  return (
    <Tooltip title={title}>
      <ToggleButton {...rest}>{children}</ToggleButton>
    </Tooltip>
  )
})

const IconButtonWithTooltip = observer(function IconButtonWithTooltip({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip title={title}>
      <IconButton
        onClick={() => {
          onClick()
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  )
})

const RecentSessionPanel = observer(function RecentSessionPanel() {
  const { classes } = useStyles()
  const { launch: launchSession } = useStartScreenLaunch()
  const notifyError = useNotifyError()
  const { height: innerHeight } = useInnerDims()
  const narrow = useMediaQuery(NARROW_QUERY, { noSsr: true })
  const compact = useMediaQuery(COMPACT_QUERY, { noSsr: true })
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
  const [selectedSessions, setSelectedSessions] = useState<RecentSessions>([])
  const [sessionsToDelete, setSessionsToDelete] = useState<RecentSessions>()
  const [now] = useState(() => Date.now())
  const [showAutosaves, setShowAutosaves] = useLocalStorage(
    'showAutosaves',
    true,
  )
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage(
    'showFavoritesOnly',
    false,
  )
  const [showSessionPath, setShowSessionPath] = useLocalStorage(
    'startScreen-showSessionPath',
    false,
  )
  const { isFavorite, toggleFavorite, pruneTo } = useFavoriteSessions()
  const {
    data: sessions = [],
    error: listSessionsError,
    mutate: refreshSessions,
  } = useFetch(
    LIST_SESSIONS_KEY,
    async () =>
      (await invokeIpc('listSessions')).map(s => ({
        ...s,
        // An entry is written from the config's own defaultSession, which need
        // not carry a name (a hub config's usually doesn't); the session model
        // resolves one for itself but the recent-sessions row keeps the gap
        // until the first autosave rewrites it. Rendering that gap put the
        // literal string "undefined" in the card and the grid.
        name: s.name ?? 'Untitled session',
      })),
    { onSuccess: pruneTo },
  )

  const launch = async (path: string) => {
    try {
      await launchSession(() => loadPluginManager(path))
    } catch (e) {
      console.error(e)
      notifyError(e, removeRecentAction(path))
    }
  }

  async function addToQuickstartList(arg: RecentSessionData[]) {
    try {
      await Promise.all(
        arg.map(s => invokeIpc('addToQuickstartList', s.path, s.name)),
      )
      // Revalidate the QuickstartPanel now that the list has changed on disk
      mutate('listQuickstarts')
    } catch (e) {
      console.error(e)
      notifyError(e)
    }
  }

  const sortedSessions = sessions.toSorted((a, b) => b.updated - a.updated)
  const filteredSessions = sortedSessions.filter(
    f =>
      (showAutosaves || !f.isAutosave) &&
      (!showFavoritesOnly || isFavorite(f.path)),
  )
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const oldAutosaves = sessions.filter(
    f => f.isAutosave && now - f.updated > thirtyDaysMs,
  )
  // The grid doesn't re-emit its selection when a filter toggle hides rows, so
  // selectedSessions can outlive the visible list. Intersect before acting so
  // delete/quickstart never touch a session the user can no longer see.
  const visiblePaths = new Set(filteredSessions.map(s => s.path))
  const visibleSelection = selectedSessions.filter(s =>
    visiblePaths.has(s.path),
  )

  return (
    <div>
      {listSessionsError ? <ErrorMessage error={listSessionsError} /> : null}
      {sessionToRename ? (
        <RenameDialog
          noun="session"
          name={sessionToRename.name}
          rename={newName =>
            invokeIpc('renameSession', sessionToRename.path, newName)
          }
          onClose={() => {
            setSessionToRename(undefined)
            refreshSessions()
          }}
        />
      ) : null}
      {sessionsToDelete ? (
        <DeleteSessionDialog
          sessionsToDelete={sessionsToDelete}
          onClose={() => {
            setSessionsToDelete(undefined)
            refreshSessions()
          }}
        />
      ) : null}
      {sessions.length ? (
        <div className={classes.flex}>
          <FormControl>
            <ToggleButtonGroup
              exclusive
              value={displayMode}
              onChange={(_, newVal) => {
                if (newVal) {
                  setDisplayMode(newVal)
                }
              }}
            >
              <ToggleButtonWithTooltip value="grid" title="Grid view">
                <ViewComfyIcon />
              </ToggleButtonWithTooltip>
              <ToggleButtonWithTooltip value="list" title="List view">
                <ListIcon />
              </ToggleButtonWithTooltip>
            </ToggleButtonGroup>
          </FormControl>
          {/* the grid drops its checkbox column at this width, so these two have
          nothing left to act on; the row's own menu carries both actions */}
          {displayMode === 'list' && !narrow && visibleSelection.length ? (
            <div style={{ display: 'flex' }}>
              <IconButtonWithTooltip
                title="Delete sessions"
                onClick={() => {
                  setSessionsToDelete(visibleSelection)
                }}
              >
                <DeleteIcon />
              </IconButtonWithTooltip>
              <IconButtonWithTooltip
                title="Add sessions to quickstart list"
                onClick={async () => {
                  await addToQuickstartList(visibleSelection)
                }}
              >
                <PlaylistAddIcon />
              </IconButtonWithTooltip>
            </div>
          ) : null}
          <CascadingMenuButton
            tooltip="More actions"
            menuItems={() => [
              {
                label: 'Show session path',
                type: 'checkbox',
                checked: showSessionPath,
                onClick: () => {
                  setShowSessionPath(!showSessionPath)
                },
              },
              {
                label: oldAutosaves.length
                  ? `Delete ${oldAutosaves.length} autosave${oldAutosaves.length === 1 ? '' : 's'} older than 30 days`
                  : 'No autosaves older than 30 days',
                disabled: !oldAutosaves.length,
                onClick: () => {
                  setSessionsToDelete(oldAutosaves)
                },
              },
            ]}
          >
            <MoreVertIcon />
          </CascadingMenuButton>
          <LabeledCheckbox
            className={classes.label}
            label="Show autosaves"
            checked={showAutosaves}
            onChange={val => {
              setShowAutosaves(val)
            }}
          />
          <LabeledCheckbox
            className={classes.label}
            label="Show favorites only"
            checked={showFavoritesOnly}
            onChange={val => {
              setShowFavoritesOnly(val)
            }}
          />
        </div>
      ) : null}

      {!filteredSessions.length ? (
        <Typography>
          {showFavoritesOnly && sortedSessions.length
            ? 'No favorite sessions'
            : 'No sessions available'}
        </Typography>
      ) : (
        // both views scroll inside what the window has left below the header
        // rather than pushing the start screen's own page scroll, so the panel
        // owns the box
        <div
          style={{
            maxHeight: Math.max(200, innerHeight - (compact ? 283 : 418)),
            overflow: 'auto',
          }}
        >
          {displayMode === 'grid' ? (
            <RecentSessionsCards
              launch={launch}
              addToQuickstartList={entry => addToQuickstartList([entry])}
              sessions={filteredSessions}
              setSessionsToDelete={setSessionsToDelete}
              setSessionToRename={setSessionToRename}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
            />
          ) : (
            <RecentSessionsDataGrid
              launch={launch}
              setSelectedSessions={setSelectedSessions}
              setSessionToRename={setSessionToRename}
              setSessionsToDelete={setSessionsToDelete}
              sessions={filteredSessions}
              showPath={showSessionPath}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              addToQuickstartList={entry => addToQuickstartList([entry])}
            />
          )}
        </div>
      )}
    </div>
  )
})

export default RecentSessionPanel
