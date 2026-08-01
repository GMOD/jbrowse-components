import { useState } from 'react'

import { pluginLabel } from '@jbrowse/core/pluginDefinitions'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import AddCustomPluginDialog from '@jbrowse/core/ui/AddCustomPluginDialog'
import PluginStoreCard from '@jbrowse/core/ui/PluginStoreCard'
import { isPluginInstalled, resolvePlugin } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetchPlugins } from '@jbrowse/core/util/useFetchPlugins'
import ClearIcon from '@mui/icons-material/Clear'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionSummary,
  Alert,
  Button,
  DialogContent,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import packageJSON from '../../../package.json' with { type: 'json' }
import { useGlobalPluginsState } from './useGlobalPluginsState.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

const useStyles = makeStyles()({
  section: {
    margin: '1em',
  },
  filter: {
    marginBottom: 8,
  },
  toolbar: {
    display: 'flex',
    gap: 8,
    margin: '1em 0',
  },
})

function InstalledGlobalPlugins({
  plugins,
  filter,
  onRemove,
}: {
  plugins: PluginDefinition[]
  filter: string
  onRemove: (index: number) => void
}) {
  const { classes } = useStyles()
  const matching = plugins
    .map((plugin, index) => ({ index, label: pluginLabel(plugin) }))
    .filter(({ label }) => label.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className={classes.section}>
      {plugins.length === 0 ? (
        <Typography>No global plugins installed</Typography>
      ) : matching.length === 0 ? (
        <Typography>No installed plugins match the filter</Typography>
      ) : (
        <List dense>
          {matching.map(({ index, label }) => (
            <ListItem key={label}>
              <Tooltip title="Remove global plugin">
                <IconButton
                  onClick={() => {
                    onRemove(index)
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
              <Typography>{label}</Typography>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  )
}

function AvailablePlugins({
  installed,
  filter,
  onInstall,
}: {
  installed: PluginDefinition[]
  filter: string
  onInstall: (definition: PluginDefinition) => void
}) {
  const { classes } = useStyles()
  const { plugins, error } = useFetchPlugins()

  return error ? (
    <div className={classes.section}>
      <ErrorMessage error={error} />
    </div>
  ) : plugins ? (
    plugins
      .filter(p => p.name.toLowerCase().includes(filter.toLowerCase()))
      .map(plugin => {
        // resolved against the running JBrowse the same way the in-session
        // plugin store does, so a global install is version-pinned, carries the
        // store's integrity hash, and is refused when no published version
        // supports this version of JBrowse
        const resolved = resolvePlugin(plugin, packageJSON.version)
        return (
          <PluginStoreCard
            key={plugin.name}
            plugin={plugin}
            resolved={resolved}
            installed={isPluginInstalled(plugin, resolved, installed)}
            onInstall={onInstall}
          />
        )
      })
  ) : (
    <LoadingEllipses />
  )
}

export default function GlobalPluginsDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [filter, setFilter] = useState('')
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const { plugins, loadError, saveError, add, remove, removeAll } =
    useGlobalPluginsState()

  return (
    <>
      <Dialog
        open
        onClose={() => {
          onClose()
        }}
        maxWidth="sm"
        fullWidth
        title="Global plugins"
      >
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            These plugins load automatically in every session. A plugin that
            crashes on load can be removed here, or skipped entirely with
            &quot;Reload without global plugins&quot; in the start screen menu.
          </Typography>
          {loadError ? <ErrorMessage error={loadError} /> : null}
          {saveError ? <ErrorMessage error={saveError} /> : null}
          {plugins ? (
            <>
              <div className={classes.toolbar}>
                <Button
                  variant="contained"
                  onClick={() => {
                    setShowCustomDialog(true)
                  }}
                >
                  Add custom plugin
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={plugins.length === 0}
                  onClick={() => {
                    removeAll()
                  }}
                >
                  Remove all
                </Button>
              </div>
              <TextField
                label="Filter plugins"
                value={filter}
                onChange={e => {
                  setFilter(e.target.value)
                }}
                fullWidth
                size="small"
                className={classes.filter}
                slotProps={{
                  input: {
                    endAdornment: filter ? (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => {
                            setFilter('')
                          }}
                          size="small"
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
              />
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Installed global plugins</Typography>
                </AccordionSummary>
                <InstalledGlobalPlugins
                  plugins={plugins}
                  filter={filter}
                  onRemove={remove}
                />
              </Accordion>
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Available plugins</Typography>
                </AccordionSummary>
                <AvailablePlugins
                  installed={plugins}
                  filter={filter}
                  onInstall={add}
                />
              </Accordion>
              <Alert severity="info">
                Changes take effect the next time a session is opened.
              </Alert>
            </>
          ) : loadError ? null : (
            <LoadingEllipses />
          )}
        </DialogContent>
      </Dialog>
      {showCustomDialog ? (
        <AddCustomPluginDialog
          onClose={() => {
            setShowCustomDialog(false)
          }}
          onAdd={definition => {
            add(definition)
            return true
          }}
        />
      ) : null}
    </>
  )
}
