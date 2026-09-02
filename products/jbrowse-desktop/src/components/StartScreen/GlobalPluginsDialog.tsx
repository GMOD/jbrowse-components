import { useState } from 'react'

import {
  desktopVendoredPluginNames,
  pluginLabel,
  pluginName,
  vendoredPluginNames,
} from '@jbrowse/core/pluginDefinitions'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import AddCustomPluginDialog from '@jbrowse/core/ui/AddCustomPluginDialog'
import PluginStoreCard from '@jbrowse/core/ui/PluginStoreCard'
import {
  installablePlugins,
  isPluginInstalled,
  resolvePlugin,
} from '@jbrowse/core/util'
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
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import packageJSON from '../../../package.json' with { type: 'json' }
import { useGlobalPluginsState } from './useGlobalPluginsState.ts'

import type { GlobalPluginEntry } from './globalPlugins.ts'
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
  onSetDisabled,
}: {
  plugins: GlobalPluginEntry[]
  filter: string
  onRemove: (index: number) => void
  onSetDisabled: (index: number, disabled: boolean) => void
}) {
  const { classes } = useStyles()
  const matching = plugins
    .map((plugin, index) => ({
      index,
      label: pluginLabel(plugin),
      disabled: Boolean(plugin.disabled),
      // installed by an older build that still offered it, and dropped by the
      // loader ever since: it reads as installed here and runs nowhere
      bundled: isBundled(plugin),
    }))
    .filter(({ label }) => label.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className={classes.section}>
      {plugins.length === 0 ? (
        <Typography>No global plugins installed</Typography>
      ) : matching.length === 0 ? (
        <Typography>No installed plugins match the filter</Typography>
      ) : (
        <List dense>
          {matching.map(({ index, label, disabled, bundled }) => (
            // keyed by position, which is also what the callbacks address: the
            // stored list is not deduped, so two entries can share a label
            <ListItem key={index}>
              <Tooltip
                title={
                  disabled
                    ? 'Load this plugin again'
                    : 'Stop loading this plugin, without removing it'
                }
              >
                <Switch
                  size="small"
                  edge="start"
                  checked={!disabled}
                  onChange={event => {
                    onSetDisabled(index, !event.target.checked)
                  }}
                  slotProps={{ input: { 'aria-label': `Enable ${label}` } }}
                />
              </Tooltip>
              <Tooltip title="Remove global plugin">
                <IconButton
                  onClick={() => {
                    onRemove(index)
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
              <Typography color={disabled ? 'textDisabled' : undefined}>
                {label}
                {disabled ? ' — disabled' : ''}
                {bundled
                  ? ' — built into JBrowse Desktop, this entry is not loaded'
                  : ''}
              </Typography>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  )
}

function isBundled(plugin: PluginDefinition) {
  const name = pluginName(plugin)
  return (
    name !== undefined &&
    (vendoredPluginNames.has(name) || desktopVendoredPluginNames.includes(name))
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
    // installablePlugins, not a bare filter: this dialog is a second install
    // surface for the same manifest, and it used to offer the plugins Desktop's
    // own core bundle already vendors — Blat, plus the shared MafViewer/GWAS.
    // The loader drops those definitions, but the global list keeps them, so the
    // card then read "Installed" for a plugin that never loaded.
    installablePlugins(plugins, true)
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
            onInstall={definition => {
              // the store's name (the UMD global, e.g. "GWAS") is what the
              // definition must be installed under, the same way the in-session
              // plugin store does it. It is already on a UMD definition, but an
              // ESM/CJS one carries none — and a nameless entry in the global
              // list is one samePlugin() can only match by url, so the same
              // plugin pinned to a different version in a config loads twice.
              //
              // The store ref beside the pinned url is what lets this entry
              // outlive the Desktop it was installed on: it resolves against
              // the store for whatever version is running at the next launch,
              // and falls back to the url when the store cannot be reached.
              onInstall({
                ...definition,
                name: plugin.name,
                storePlugin: plugin.name,
              })
            }}
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
  const { plugins, loadError, saveError, add, remove, removeAll, setDisabled } =
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
            These plugins load automatically in every session. One that crashes
            on load can be switched off here — which keeps it installed, so it
            can be switched back on — or removed outright; and the whole list
            can be skipped for one launch with &quot;Reload without global
            plugins&quot; in the start screen menu.
          </Typography>
          {loadError && !plugins ? <ErrorMessage error={loadError} /> : null}
          {saveError ? <ErrorMessage error={saveError} /> : null}
          {loadError && !plugins ? (
            // The list cannot be read, so there is nothing to edit and every
            // control below is hidden — which used to leave this dialog with no
            // way out of a corrupt globalPlugins.json at all, short of a factory
            // reset that also costs the user every session they have.
            <div className={classes.toolbar}>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  removeAll()
                }}
              >
                Reset the global plugin list
              </Button>
            </div>
          ) : null}
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
                  onSetDisabled={setDisabled}
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
