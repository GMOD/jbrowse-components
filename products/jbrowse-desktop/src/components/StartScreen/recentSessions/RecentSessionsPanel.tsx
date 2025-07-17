import { useEffect, useMemo, useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import ListIcon from '@mui/icons-material/List'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import {
  FormControl,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import Checkbox2 from '../Checkbox2'
import RecentSessionsCards from './RecentSessionsCards'
import RecentSessionsList from './RecentSessionsDataGrid'
import DeleteSessionDialog from '../dialogs/DeleteSessionDialog'
import RenameSessionDialog from '../dialogs/RenameSessionDialog'

import type { RecentSessionData } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ToggleButtonProps } from '@mui/material'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()({
  flex: {
    display: 'flex',
    gap: 20,
  },
  verticalCenter: {
    margin: 'auto 0',
  },
})

type RecentSessions = RecentSessionData[]

// uses span to allow disabled button to have a tooltip
function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const { title = '', children, ...rest } = props
  return (
    <Tooltip title={title}>
      <span>
        <ToggleButton {...rest}>{children}</ToggleButton>
      </span>
    </Tooltip>
  )
}

export default function RecentSessionPanel({
  setError,
  setPluginManager,
}: {
  setError: (e: unknown) => void
  setPluginManager: (pm: PluginManager) => void
}) {
  const { classes } = useStyles()
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  const [sessions, setSessions] = useState<RecentSessions>([])
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
  const [updateSessionsList, setUpdateSessionsList] = useState(0)
  const [selectedSessions, setSelectedSessions] = useState<RecentSessions>()
  const [sessionsToDelete, setSessionsToDelete] = useState<RecentSessions>()
  const [showAutosaves, setShowAutosaves] = useLocalStorage(
    'showAutosaves',
    true,
  )
  const [showFavoritesOnly, setShowFavoritesOnly] = useLocalStorage(
    'showFavoritesOnly',
    false,
  )

  const sortedSessions = useMemo(
    () => sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0)),
    [sessions],
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const sessions = await ipcRenderer.invoke('listSessions', showAutosaves)
        setSessions(sessions)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [setError, updateSessionsList, showAutosaves])

  async function addToQuickstartList(arg: RecentSessionData[]) {
    await Promise.all(
      arg.map(s => ipcRenderer.invoke('addToQuickstartList', s.path, s.name)),
    )
  }

  const [favorites, setFavorites] = useLocalStorage(
    'startScreen-favoriteSessions',
    [] as string[],
  )

  const toggleFavorite = (sessionPath: string) => {
    if (favs.has(sessionPath)) {
      setFavorites(favorites.filter(path => path !== sessionPath))
    } else {
      setFavorites([...favorites, sessionPath])
    }
  }

  const favs = new Set(favorites)
  const filteredSessions = sortedSessions.filter(f =>
    showFavoritesOnly ? favs.has(f.path) : true,
  )
  return (
    <div>
      {sessionToRename ? (
        <RenameSessionDialog
          sessionToRename={sessionToRename}
          onClose={() => {
            setSessionToRename(undefined)
            setUpdateSessionsList(s => s + 1)
          }}
        />
      ) : null}
      {sessionsToDelete ? (
        <DeleteSessionDialog
          setError={setError}
          sessionsToDelete={sessionsToDelete}
          onClose={() => {
            setSessionsToDelete(undefined)
            setUpdateSessionsList(s => s + 1)
          }}
        />
      ) : null}
      <div className={classes.flex}>
        <FormControl>
          <ToggleButtonGroup
            exclusive
            value={displayMode}
            onChange={(_, newVal) => {
              setDisplayMode(newVal)
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
        <FormControl>
          <ToggleButtonGroup>
            <ToggleButtonWithTooltip
              value="delete"
              title="Delete sessions"
              disabled={!selectedSessions?.length}
              onClick={() => {
                setSessionsToDelete(selectedSessions)
              }}
            >
              <DeleteIcon />
            </ToggleButtonWithTooltip>
            <ToggleButtonWithTooltip
              value="quickstart"
              title="Add sessions to quickstart list"
              disabled={!selectedSessions?.length}
              onClick={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(async () => {
                  try {
                    await addToQuickstartList(selectedSessions || [])
                  } catch (e) {
                    setError(e)
                    console.error(e)
                  }
                })()
              }}
            >
              <PlaylistAddIcon />
            </ToggleButtonWithTooltip>
          </ToggleButtonGroup>
        </FormControl>
        <Checkbox2
          label="Show autosaves"
          checked={showAutosaves}
          onChange={() => {
            setShowAutosaves(!showAutosaves)
          }}
        />
        <Checkbox2
          label="Show favorites only"
          checked={showFavoritesOnly}
          onChange={() => {
            setShowFavoritesOnly(!showFavoritesOnly)
          }}
        />
      </div>

      {sortedSessions.length ? (
        displayMode === 'grid' ? (
          <RecentSessionsCards
            addToQuickstartList={entry => addToQuickstartList([entry])}
            setPluginManager={setPluginManager}
            sessions={filteredSessions}
            setError={setError}
            setSessionsToDelete={setSessionsToDelete}
            setSessionToRename={setSessionToRename}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        ) : (
          <RecentSessionsList
            setPluginManager={setPluginManager}
            setError={setError}
            setSelectedSessions={setSelectedSessions}
            setSessionToRename={setSessionToRename}
            sessions={filteredSessions}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        )
      ) : (
        <Typography>No sessions available</Typography>
      )}
    </div>
  )
}
