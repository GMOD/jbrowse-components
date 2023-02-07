import React, { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  ToggleButtonProps,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import PluginManager from '@jbrowse/core/PluginManager'
import { useLocalStorage } from '@jbrowse/core/util'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'
import ListIcon from '@mui/icons-material/List'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'

// locals
import RenameSessionDialog from './dialogs/RenameSessionDialog'
import DeleteSessionDialog from './dialogs/DeleteSessionDialog'
import { loadPluginManager, RecentSessionData } from './util'
import RecentSessionsCards from './RecentSessionCards'
import RecentSessionsList from './RecentSessionList'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()({
  toggleButton: {
    '&.Mui-disabled': {
      pointerEvents: 'auto',
    },
  },
})

type RecentSessions = RecentSessionData[]

// note: adjust props so disabled button can have a tooltip and not lose styling
// https://stackoverflow.com/a/63276424
function ToggleButtonWithTooltip(props: ToggleButtonProps) {
  const { classes } = useStyles()
  const { title = '', children, disabled, onClick, ...other } = props
  const adjustedButtonProps = {
    disabled: disabled,
    component: disabled ? 'div' : undefined,
    onClick: disabled ? undefined : onClick,
  }
  return (
    <Tooltip title={title}>
      <ToggleButton
        {...other}
        {...adjustedButtonProps}
        classes={{ root: classes.toggleButton }}
      >
        {children}
      </ToggleButton>
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
  const [displayMode, setDisplayMode] = useLocalStorage('displayMode', 'list')
  const [sessions, setSessions] = useState<RecentSessions>([])
  const [sessionToRename, setSessionToRename] = useState<RecentSessionData>()
  const [updateSessionsList, setUpdateSessionsList] = useState(0)
  const [selectedSessions, setSelectedSessions] = useState<RecentSessions>()
  const [sessionsToDelete, setSessionsToDelete] = useState<RecentSessions>()
  const [showAutosaves, setShowAutosaves] = useLocalStorage(
    'showAutosaves',
    'false',
  )

  const sortedSessions = useMemo(
    () => sessions?.sort((a, b) => b.updated - a.updated),
    [sessions],
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const sessions = await ipcRenderer.invoke(
          'listSessions',
          showAutosaves === 'true',
        )
        setSessions(sessions)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [setError, updateSessionsList, showAutosaves])

  if (!sessions) {
    return (
      <CircularProgress
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          marginTop: -25,
          marginLeft: -25,
        }}
        size={50}
      />
    )
  }

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
      <Grid container spacing={4} alignItems="center">
        <Grid item>
          <FormControl>
            <ToggleButtonGroup
              exclusive
              value={displayMode}
              onChange={(_, newVal) => setDisplayMode(newVal)}
            >
              <ToggleButtonWithTooltip value="grid" title="Grid view">
                <ViewComfyIcon />
              </ToggleButtonWithTooltip>
              <ToggleButtonWithTooltip value="list" title="List view">
                <ListIcon />
              </ToggleButtonWithTooltip>
            </ToggleButtonGroup>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            <ToggleButtonGroup>
              <ToggleButtonWithTooltip
                value="delete"
                title="Delete sessions"
                disabled={!selectedSessions?.length}
                onClick={() => setSessionsToDelete(selectedSessions)}
              >
                <DeleteIcon />
              </ToggleButtonWithTooltip>
              <ToggleButtonWithTooltip
                value="quickstart"
                title="Add sessions to quickstart list"
                disabled={!selectedSessions?.length}
                onClick={() => addToQuickstartList(selectedSessions || [])}
              >
                <PlaylistAddIcon />
              </ToggleButtonWithTooltip>
            </ToggleButtonGroup>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControlLabel
            control={
              <Checkbox
                checked={showAutosaves === 'true'}
                onChange={() =>
                  setShowAutosaves(showAutosaves === 'true' ? 'false' : 'true')
                }
              />
            }
            label="Show autosaves"
          />
        </Grid>
        <Grid item>
          <Button variant="contained" component="label" onClick={() => {}}>
            Open saved session (.jbrowse) file
            <input
              type="file"
              hidden
              onChange={async ({ target }) => {
                try {
                  const file = target && target.files && target.files[0]
                  if (file) {
                    const path = (file as File & { path: string }).path
                    setPluginManager(await loadPluginManager(path))
                  }
                } catch (e) {
                  console.error(e)
                  setError(e)
                }
              }}
            />
          </Button>
        </Grid>
      </Grid>

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
