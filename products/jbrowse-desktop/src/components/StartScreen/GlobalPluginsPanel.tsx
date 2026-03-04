import { useEffect, useState } from 'react'

import {
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

const { ipcRenderer } = window.require('electron')

export default function GlobalPluginsPanel() {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([])
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string>()

  useEffect(() => {
    ipcRenderer
      .invoke('getGlobalPlugins')
      .then((p: PluginDefinition[]) => {
        setPlugins(p)
      })
      .catch((e: unknown) => {
        console.error(e)
      })
  }, [])

  async function handleAdd() {
    if (!url.trim()) {
      return
    }
    const newPlugin: PluginDefinition = { esmUrl: url.trim() }
    const updated = [...plugins, newPlugin]
    try {
      await ipcRenderer.invoke('setGlobalPlugins', updated)
      setPlugins(updated)
      setUrl('')
      setError(undefined)
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleRemove(index: number) {
    const updated = plugins.filter((_, i) => i !== index)
    try {
      await ipcRenderer.invoke('setGlobalPlugins', updated)
      setPlugins(updated)
      setError(undefined)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div>
      <Typography variant="h6">Global plugins</Typography>
      <Typography variant="body2" color="textSecondary">
        These plugins load automatically in every session.
      </Typography>
      {error ? (
        <Typography color="error">{error}</Typography>
      ) : null}
      <List dense>
        {plugins.map((plugin, idx) => (
          <ListItem
            key={idx}
            secondaryAction={
              <IconButton edge="end" onClick={() => handleRemove(idx)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText primary={getPluginLabel(plugin)} />
          </ListItem>
        ))}
      </List>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TextField
          size="small"
          label="Plugin ESM URL"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleAdd()
            }
          }}
          style={{ flex: 1 }}
        />
        <Button variant="contained" size="small" onClick={handleAdd}>
          Add
        </Button>
      </div>
    </div>
  )
}

function getPluginLabel(plugin: PluginDefinition) {
  if ('esmUrl' in plugin) {
    return plugin.esmUrl
  }
  if ('cjsUrl' in plugin) {
    return plugin.cjsUrl
  }
  if ('umdUrl' in plugin) {
    return `${plugin.name} (${plugin.umdUrl})`
  }
  if ('url' in plugin) {
    return `${plugin.name} (${plugin.url})`
  }
  if ('esmLoc' in plugin) {
    return plugin.esmLoc.uri
  }
  if ('umdLoc' in plugin) {
    return `${plugin.name} (${plugin.umdLoc.uri})`
  }
  return JSON.stringify(plugin)
}
