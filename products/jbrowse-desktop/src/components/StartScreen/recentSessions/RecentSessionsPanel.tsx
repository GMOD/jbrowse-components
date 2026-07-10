import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { mutate, useFetch, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import ListIcon from '@mui/icons-material/List'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'

import RecentSessionsCards from './RecentSessionsCards.tsx'
import RecentSessionsDataGrid from './RecentSessionsDataGrid.tsx'
import { useNotifyError } from '../../NotifyContext.ts'
import DeleteSessionDialog from '../dialogs/DeleteSessionDialog.tsx'
import RenameSessionDialog from '../dialogs/RenameSessionDialog.tsx'
import { loadPluginManager } from '../util.tsx'

import type { RecentSessionData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ToggleButtonProps } from '@mui/material'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
})

type RecentSessions = RecentSessionData[]

function ToggleButtonWithTooltip({
  title = '',
  children,
  ...rest
}: ToggleButtonProps) {
  return (
    <Tooltip title={title}>
      <ToggleButton {...rest}>{children}</ToggleButton>
    </Tooltip>
  )
}

function IconButtonWithTooltip({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          disabled={disabled}
          onClick={() => {
            onClick()
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default function RecentSessionPanel({
  setPluginManager,
}: {
  setPluginManager: (pm: PluginManager) => void
}) {
  const { classes } = useStyles()
  const notifyError = useNotifyError()
  const [sessionLoading, setSessionLoading] = useState(false)
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
  const [selectedSessions, setSelectedSessions] = useState<RecentSessions>([])
  const [sessionsToDelete, setSessionsToDelete] = useState<RecentSessions>()
  const [showAutosaves, setShowAutosaves] = useLocalStorage(
    'showAutosaves',
    true,
  )
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage(
    'showFavoritesOnly',
    false,
  )
  const [favorites, setFavorites] = useLocalStorage(
    'startScreen-favoriteSessions',
    [] as string[],
  )
  const {
    data: sessions = [],
    error: listSessionsError,
    mutate: mutateSessions,
  } = useFetch(
    ['listSessions', showAutosaves],
    () =>
      ipcRenderer.invoke('listSessions', showAutosaves) as Promise<
        RecentSessionData[]
      >,
  )

  const launch = async (path: string) => {
    setSessionLoading(true)
    try {
      setPluginManager(await loadPluginManager(path))
    } catch (e) {
      console.error(e)
      notifyError(e)
    } finally {
      setSessionLoading(false)
    }
  }

  const refreshSessions = () => {
    mutateSessions().catch(console.error)
  }

  async function addToQuickstartList(arg: RecentSessionData[]) {
    try {
      await Promise.all(
        arg.map(s => ipcRenderer.invoke('addToQuickstartList', s.path, s.name)),
      )
      // Revalidate the QuickstartPanel's shared SWR cache key now that the
      // list has changed on disk.
      await mutate('listQuickstarts')
    } catch (e) {
      console.error(e)
      notifyError(e)
    }
  }

  const favs = new Set(favorites)
  const toggleFavorite = (sessionPath: string) => {
    if (favs.has(sessionPath)) {
      setFavorites(favorites.filter(path => path !== sessionPath))
    } else {
      setFavorites([...favorites, sessionPath])
    }
  }
  const sortedSessions = sessions.toSorted(
    (a, b) => (b.updated ?? 0) - (a.updated ?? 0),
  )
  const filteredSessions = sortedSessions.filter(
    f => !showFavoritesOnly || favs.has(f.path),
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
        <RenameSessionDialog
          sessionToRename={sessionToRename}
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
        {displayMode === 'list' ? (
          <div style={{ display: 'flex' }}>
            <IconButtonWithTooltip
              title="Delete sessions"
              disabled={!visibleSelection.length}
              onClick={() => {
                setSessionsToDelete(visibleSelection)
              }}
            >
              <DeleteIcon />
            </IconButtonWithTooltip>
            <IconButtonWithTooltip
              title="Add sessions to quickstart list"
              disabled={!visibleSelection.length}
              onClick={async () => {
                await addToQuickstartList(visibleSelection)
              }}
            >
              <PlaylistAddIcon />
            </IconButtonWithTooltip>
          </div>
        ) : null}
        <FormControlLabel
          label="Show autosaves"
          control={
            <Checkbox
              checked={showAutosaves}
              onChange={() => {
                setShowAutosaves(!showAutosaves)
              }}
            />
          }
        />
        <FormControlLabel
          label="Show favorites only"
          control={
            <Checkbox
              checked={showFavoritesOnly}
              onChange={() => {
                setShowFavoritesOnly(!showFavoritesOnly)
              }}
            />
          }
        />

        <Button variant="contained" component="label" disabled={sessionLoading}>
          Open saved session (.jbrowse) file
          <input
            type="file"
            hidden
            onChange={async event => {
              const file = event.target.files?.[0]
              if (file) {
                const { webUtils } = window.require('electron')
                await launch(webUtils.getPathForFile(file))
              }
            }}
          />
        </Button>
      </div>

      {!filteredSessions.length ? (
        <Typography>
          {showFavoritesOnly && sortedSessions.length
            ? 'No favorite sessions'
            : 'No sessions available'}
        </Typography>
      ) : displayMode === 'grid' ? (
        <RecentSessionsCards
          launch={launch}
          addToQuickstartList={entry => addToQuickstartList([entry])}
          sessions={filteredSessions}
          setSessionsToDelete={setSessionsToDelete}
          setSessionToRename={setSessionToRename}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
        />
      ) : (
        <RecentSessionsDataGrid
          launch={launch}
          setSelectedSessions={setSelectedSessions}
          setSessionToRename={setSessionToRename}
          sessions={filteredSessions}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToQuickstartList={entry => addToQuickstartList([entry])}
        />
      )}
    </div>
  )
}
