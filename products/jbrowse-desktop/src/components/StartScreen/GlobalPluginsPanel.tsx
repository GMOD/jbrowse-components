import { useState } from 'react'

import { pluginDescriptionString, pluginUrl } from '@jbrowse/core/PluginLoader'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util/useFetch'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

const { ipcRenderer } = window.require('electron')

export default function GlobalPluginsPanel() {
  const [url, setUrl] = useState('')
  const [writeError, setWriteError] = useState<unknown>()
  const {
    data: plugins,
    error: readError,
    mutate: refetchPlugins,
  } = useFetch(
    'getGlobalPlugins',
    () => ipcRenderer.invoke('getGlobalPlugins') as Promise<PluginDefinition[]>,
  )

  async function setPlugins(updated: PluginDefinition[]) {
    try {
      setWriteError(undefined)
      await ipcRenderer.invoke('setGlobalPlugins', updated)
      refetchPlugins()
    } catch (e) {
      setWriteError(e)
    }
  }

  async function handleAdd() {
    const esmUrl = url.trim()
    if (plugins && esmUrl && !plugins.some(p => pluginUrl(p) === esmUrl)) {
      await setPlugins([...plugins, { esmUrl }])
      setUrl('')
    }
  }

  return (
    <div>
      <Typography variant="h6">Global plugins</Typography>
      <Typography variant="body2" color="textSecondary">
        These plugins load automatically in every session.
      </Typography>
      {readError ? <ErrorMessage error={readError} /> : null}
      {writeError ? <ErrorMessage error={writeError} /> : null}
      {plugins === undefined ? (
        readError ? null : (
          <LoadingEllipses />
        )
      ) : (
        <>
          <List dense>
            {plugins.map((plugin, idx) => (
              <ListItem
                key={pluginDescriptionString(plugin)}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => {
                      // setPlugins captures its own failure into writeError
                      void setPlugins(plugins.filter((_, i) => i !== idx))
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={pluginDescriptionString(plugin)} />
              </ListItem>
            ))}
          </List>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TextField
              size="small"
              label="Plugin ESM URL"
              value={url}
              onChange={event => {
                setUrl(event.target.value)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  void handleAdd()
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                void handleAdd()
              }}
            >
              Add
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
