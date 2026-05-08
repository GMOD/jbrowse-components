import { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import ListIcon from '@mui/icons-material/List'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import {
  Button,
  FormControl,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { useFetch } from '@jbrowse/core/util'

import Checkbox2 from '../Checkbox2.tsx'
import RecentSessionsCards from './RecentSessionsCards.tsx'
import RecentSessionsList from './RecentSessionsDataGrid.tsx'
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
    gap: 10,
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
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
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
  const [favorites, setFavorites] = useLocalStorage(
    'startScreen-favoriteSessions',
    [] as string[],
  )

  const { data: sessions = [], mutate: mutateSessions } = useFetch(
    ['listSessions', showAutosaves],
    () =>
      ipcRenderer.invoke('listSessions', showAutosaves) as Promise<
        RecentSessionData[]
      >,
    {
      onError: e => {
        console.error(e)
        setError(e)
      },
    },
  )

  async function addToQuickstartList(arg: RecentSessionData[]) {
    await Promise.all(
      arg.map(s => ipcRenderer.invoke('addToQuickstartList', s.path, s.name)),
    )
  }

  const favs = new Set(favorites)
  const sortedSessions = sessions.toSorted(
    (a, b) => (b.updated ?? 0) - (a.updated ?? 0),
  )
  const filteredSessions = sortedSessions.filter(
    f => !showFavoritesOnly || favs.has(f.path),
  )
  return (
    <div>
      {sessionToRename ? (
        <RenameSessionDialog
          sessionToRename={sessionToRename}
          onClose={() => {
            setSessionToRename(undefined)
            void mutateSessions()
          }}
        />
      ) : null}
      {sessionsToDelete ? (
        <DeleteSessionDialog
          setError={setError}
          sessionsToDelete={sessionsToDelete}
          onClose={() => {
            setSessionsToDelete(undefined)
            void mutateSessions()
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
              onClick={async () => {
                try {
                  await addToQuickstartList(selectedSessions ?? [])
                } catch (e) {
                  setError(e)
                  console.error(e)
                }
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

        <div className={classes.verticalCenter}>
          <Button variant="contained" component="label">
            Open saved session (.jbrowse) file
            <input
              type="file"
              hidden
              onChange={async event => {
                try {
                  const file = event.target.files?.[0]
                  if (file) {
                    const { webUtils } = window.require('electron')
                    const path = webUtils.getPathForFile(file)
                    setPluginManager(await loadPluginManager(path))
                  }
                } catch (e) {
                  console.error(e)
                  setError(e)
                }
              }}
            />
          </Button>
        </div>
      </div>

      {!sortedSessions.length ? (
        <Typography>No sessions available</Typography>
      ) : null}

      {sortedSessions.length > 0 && displayMode === 'grid' ? (
        <RecentSessionsCards
          addToQuickstartList={entry => addToQuickstartList([entry])}
          setPluginManager={setPluginManager}
          sessions={filteredSessions}
          setError={setError}
          setSessionsToDelete={setSessionsToDelete}
          setSessionToRename={setSessionToRename}
        />
      ) : null}

      {sortedSessions.length > 0 && displayMode === 'list' ? (
        <RecentSessionsList
          setPluginManager={setPluginManager}
          setError={setError}
          setSelectedSessions={setSelectedSessions}
          setSessionToRename={setSessionToRename}
          sessions={filteredSessions}
          favorites={favorites}
          toggleFavorite={sessionPath => {
            if (favs.has(sessionPath)) {
              setFavorites(favorites.filter(path => path !== sessionPath))
            } else {
              setFavorites([...favorites, sessionPath])
            }
          }}
          addToQuickstartList={entry => addToQuickstartList([entry])}
        />
      ) : null}
    </div>
  )
}
