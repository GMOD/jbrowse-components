import { useEffect, useMemo, useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import ListIcon from '@mui/icons-material/List'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import RecentSessionsCards from './RecentSessionCards'
import RecentSessionsList from './RecentSessionList'
import DeleteSessionDialog from './dialogs/DeleteSessionDialog'
import RenameSessionDialog from './dialogs/RenameSessionDialog'
import { loadPluginManager } from './util'

import type { RecentSessionData } from './util'
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

// note: adjust props so disabled button can have a tooltip and not lose styling
// https://stackoverflow.com/a/63276424
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

  const sortedSessions = useMemo(
    () => sessions.sort((a, b) => (b.updated || 0) - (a.updated || 0)),
    [sessions],
  )

  /* biome-ignore lint/correctness/useExhaustiveDependencies: */
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
        <FormControlLabel
          control={
            <Checkbox
              checked={showAutosaves}
              onChange={() => {
                setShowAutosaves(!showAutosaves)
              }}
            />
          }
          label="Show autosaves"
        />
        <div className={classes.verticalCenter}>
          <Button variant="contained" component="label" onClick={() => {}}>
            Open saved session (.jbrowse) file
            <input
              type="file"
              hidden
              onChange={async ({ target }) => {
                try {
                  const file = target.files?.[0]
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

      {sortedSessions.length ? (
        displayMode === 'grid' ? (
          <RecentSessionsCards
            addToQuickstartList={entry => addToQuickstartList([entry])}
            setPluginManager={setPluginManager}
            sessions={sortedSessions}
            setError={setError}
            setSessionsToDelete={setSessionsToDelete}
            setSessionToRename={setSessionToRename}
          />
        ) : (
          <RecentSessionsList
            setPluginManager={setPluginManager}
            sessions={sortedSessions}
            setError={setError}
            setSelectedSessions={setSelectedSessions}
            setSessionToRename={setSessionToRename}
          />
        )
      ) : (
        <Typography>No sessions available</Typography>
      )}
    </div>
  )
}
