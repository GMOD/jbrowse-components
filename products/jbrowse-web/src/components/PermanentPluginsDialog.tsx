import { useState } from 'react'

import { pluginLabel, pluginUrl } from '@jbrowse/core/pluginDefinitions'
import { Dialog } from '@jbrowse/core/ui'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  IconButton,
  List,
  ListItem,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material'

import {
  clearPermanentPlugins,
  permanentPluginSafeMode,
  permanentPluginSafeModeSuspects,
  readPermanentPlugins,
  reloadWithPermanentPlugins,
  removePermanentPlugin,
  setPermanentPluginDisabled,
} from '../permanentPlugins.ts'

import type { PermanentPluginEntry } from '../permanentPlugins.ts'

// What the plugin store's keep toggle writes, seen as a list — and the one
// surface that can still switch a plugin off after it has taken the app down,
// since safe mode is what got the user back here.
//
// The entries are read into component state rather than observed: the list
// lives in localStorage, not in the session tree. Every write here goes through
// the module, which is also what refreshes the session's own mirror.
export default function PermanentPluginsDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const [entries, setEntries] = useState(readPermanentPlugins)
  const safeMode = permanentPluginSafeMode()
  const suspects = permanentPluginSafeModeSuspects()
  const edit = (fn: () => void) => {
    fn()
    setEntries(readPermanentPlugins())
  }
  return (
    <Dialog open onClose={onClose} title="Permanent plugins" maxWidth="xl">
      <DialogContent style={{ width: 800 }}>
        {safeMode ? (
          <Alert severity="warning">
            {safeMode === 'previousLaunchFailed'
              ? `These plugins were skipped because the last load of this JBrowse did not finish.${
                  suspects.length ? ` Loading: ${suspects.join(', ')}.` : ''
                } Switch off whichever one you suspect, then turn them back on.`
              : 'These plugins are skipped because this URL asked for safe mode.'}
          </Alert>
        ) : null}
        {entries.length ? (
          <>
            <Typography>
              Plugins kept for this JBrowse in this browser. They load on every
              visit, alongside whatever the configuration itself installs, and
              nothing but this browser knows about them — a session you share
              carries none of them.
            </Typography>
            <List>
              {entries.map(entry => (
                <PermanentPluginRow
                  key={pluginUrl(entry)}
                  entry={entry}
                  onToggle={disabled => {
                    edit(() => {
                      setPermanentPluginDisabled(entry, disabled)
                    })
                  }}
                  onRemove={() => {
                    edit(() => {
                      removePermanentPlugin(entry)
                    })
                  }}
                />
              ))}
            </List>
            <Typography variant="body2">
              Changes take effect the next time this JBrowse loads.
            </Typography>
          </>
        ) : (
          <Typography>
            No plugins are kept for this JBrowse. Install one from the plugin
            store, then use the pin beside it to keep it for every visit.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {entries.length ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              edit(clearPermanentPlugins)
            }}
          >
            Remove all
          </Button>
        ) : null}
        {safeMode ? (
          <Button
            variant="contained"
            onClick={() => {
              reloadWithPermanentPlugins()
            }}
          >
            Turn back on and reload
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => {
              window.location.reload()
            }}
          >
            Reload
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function PermanentPluginRow({
  entry,
  onToggle,
  onRemove,
}: {
  entry: PermanentPluginEntry
  onToggle: (disabled: boolean) => void
  onRemove: () => void
}) {
  return (
    <ListItem disableGutters>
      <Tooltip
        title={entry.disabled ? 'Switched off' : 'Loaded on every visit'}
      >
        <Switch
          checked={!entry.disabled}
          onChange={event => {
            onToggle(!event.target.checked)
          }}
        />
      </Tooltip>
      <Typography style={{ flexGrow: 1, overflowWrap: 'anywhere' }}>
        {pluginLabel(entry)}
      </Typography>
      <Tooltip title="Remove from this list">
        <IconButton
          onClick={() => {
            onRemove()
          }}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </ListItem>
  )
}
