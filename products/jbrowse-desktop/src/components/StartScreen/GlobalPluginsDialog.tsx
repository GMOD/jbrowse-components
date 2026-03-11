import { useEffect, useState } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import ClearIcon from '@mui/icons-material/Clear'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PersonIcon from '@mui/icons-material/Person'
import {
  Accordion,
  AccordionSummary,
  Button,
  Card,
  CardActions,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type { JBrowsePlugin } from '@jbrowse/core/util/types'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  card: {
    margin: '0.5em',
  },
  bold: {
    fontWeight: 600,
  },
  dataField: {
    display: 'flex',
    alignItems: 'center',
  },
  mr: {
    marginRight: '0.5em',
  },
  m: {
    margin: '1em',
  },
  customPluginButton: {
    margin: '1em auto',
    display: 'flex',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  expand: {
    transform: 'rotate(0deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  expandOpen: {
    transform: 'rotate(180deg)',
  },
}))

function useFetchPlugins() {
  const [plugins, setPlugins] = useState<JBrowsePlugin[]>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const res = await fetch('https://jbrowse.org/plugin-store/plugins.json')
        if (!res.ok) {
          const err = await res.text()
          throw new Error(`HTTP ${res.status} fetching plugins: ${err}`)
        }
        const array = await res.json()
        setPlugins(array.plugins)
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [])
  return { plugins, error }
}

function getPluginName(plugin: PluginDefinition) {
  if ('name' in plugin) {
    return plugin.name
  }
  return undefined
}

function isPluginInstalled(
  storePlugin: JBrowsePlugin,
  globalPlugins: PluginDefinition[],
) {
  return globalPlugins.some(
    gp => getPluginName(gp) === storePlugin.name,
  )
}

function pluginToDefinition(plugin: JBrowsePlugin): PluginDefinition {
  if (plugin.url) {
    return { url: plugin.url, name: plugin.name }
  }
  if (plugin.umdUrl) {
    return { umdUrl: plugin.umdUrl, name: plugin.name }
  }
  if (plugin.esmUrl) {
    return { esmUrl: plugin.esmUrl }
  }
  if (plugin.cjsUrl) {
    return { cjsUrl: plugin.cjsUrl }
  }
  return { url: '', name: plugin.name }
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

function AddCustomGlobalPluginDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (plugin: PluginDefinition) => void
}) {
  const { classes } = useStyles()
  const [umdPluginName, setUMDPluginName] = useState('')
  const [umdPluginUrl, setUMDPluginUrl] = useState('')
  const [esmPluginUrl, setESMPluginUrl] = useState('')
  const [cjsPluginUrl, setCJSPluginUrl] = useState('')
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)
  const ready = Boolean(
    (umdPluginName && umdPluginUrl) || esmPluginUrl || cjsPluginUrl,
  )

  function handleSubmit() {
    if (umdPluginName && umdPluginUrl) {
      onAdd({ name: umdPluginName, umdUrl: umdPluginUrl })
    } else if (esmPluginUrl) {
      onAdd({ esmUrl: esmPluginUrl })
    } else if (cjsPluginUrl) {
      onAdd({ cjsUrl: cjsPluginUrl })
    }
    onClose()
  }

  return (
    <Dialog open onClose={onClose} title="Add custom plugin">
      <DialogTitle>Add custom plugin</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className={classes.dialogContent}>
          <DialogContentText>
            Enter the name of the plugin and its URL. The name should match what
            is defined in the plugin&apos;s build.
          </DialogContentText>
          <TextField
            label="Plugin name"
            variant="outlined"
            value={umdPluginName}
            onChange={e => setUMDPluginName(e.target.value)}
          />
          <TextField
            label="Plugin URL"
            variant="outlined"
            value={umdPluginUrl}
            onChange={e => setUMDPluginUrl(e.target.value)}
          />
          <DialogContentText
            onClick={() => setAdvancedOptionsOpen(!advancedOptionsOpen)}
            style={{ cursor: 'pointer' }}
          >
            <IconButton
              className={cx(classes.expand, {
                [classes.expandOpen]: advancedOptionsOpen,
              })}
              aria-expanded={advancedOptionsOpen}
              aria-label="show more"
            >
              <ExpandMoreIcon />
            </IconButton>
            Advanced options
          </DialogContentText>
          <Collapse in={advancedOptionsOpen}>
            <div className={classes.dialogContent}>
              <DialogContentText>
                The above fields assume that the plugin is built in UMD format.
                If your plugin is in another format, or you have additional
                builds you want to add (such as a CJS build for using NodeJS
                APIs in desktop), you can enter the URLs for those builds below.
              </DialogContentText>
              <TextField
                label="ESM build URL"
                variant="outlined"
                value={esmPluginUrl}
                onChange={e => setESMPluginUrl(e.target.value)}
              />
              <TextField
                label="CJS build URL"
                variant="outlined"
                value={cjsPluginUrl}
                onChange={e => setCJSPluginUrl(e.target.value)}
              />
            </div>
          </Collapse>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={!ready}
          >
            Submit
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default function GlobalPluginsDialog({
  onClose,
}: {
  onClose: () => void
}) {
  const { classes } = useStyles()
  const { plugins: storePlugins, error: fetchError } = useFetchPlugins()
  const [globalPlugins, setGlobalPlugins] = useState<PluginDefinition[]>([])
  const [filterText, setFilterText] = useState('')
  const [saveError, setSaveError] = useState<string>()
  const [showCustomDialog, setShowCustomDialog] = useState(false)

  useEffect(() => {
    ipcRenderer
      .invoke('getGlobalPlugins')
      .then((p: PluginDefinition[]) => {
        setGlobalPlugins(p)
      })
      .catch((e: unknown) => {
        console.error(e)
      })
  }, [])

  async function handleInstall(plugin: JBrowsePlugin) {
    const def = pluginToDefinition(plugin)
    const updated = [...globalPlugins, def]
    try {
      await ipcRenderer.invoke('setGlobalPlugins', updated)
      setGlobalPlugins(updated)
      setSaveError(undefined)
    } catch (e) {
      setSaveError(String(e))
    }
  }

  async function handleAddCustom(plugin: PluginDefinition) {
    const updated = [...globalPlugins, plugin]
    try {
      await ipcRenderer.invoke('setGlobalPlugins', updated)
      setGlobalPlugins(updated)
      setSaveError(undefined)
    } catch (e) {
      setSaveError(String(e))
    }
  }

  async function handleRemove(index: number) {
    const updated = globalPlugins.filter((_, i) => i !== index)
    try {
      await ipcRenderer.invoke('setGlobalPlugins', updated)
      setGlobalPlugins(updated)
      setSaveError(undefined)
    } catch (e) {
      setSaveError(String(e))
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Global Plugins</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          These plugins load automatically in every session.
        </Typography>
        <Button
          className={classes.customPluginButton}
          variant="contained"
          onClick={() => setShowCustomDialog(true)}
        >
          Add custom plugin
        </Button>
        {saveError ? (
          <Typography color="error">{saveError}</Typography>
        ) : null}
        <TextField
          label="Filter plugins"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          fullWidth
          size="small"
          style={{ marginBottom: 8 }}
          slotProps={{
            input: {
              endAdornment: filterText ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setFilterText('')} size="small">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              Installed global plugins
            </Typography>
          </AccordionSummary>
          <div className={classes.m}>
            {globalPlugins.length > 0 ? (
              <List dense>
                {globalPlugins.map((plugin, idx) => {
                  const label = getPluginLabel(plugin)
                  if (
                    filterText &&
                    !label.toLowerCase().includes(filterText.toLowerCase())
                  ) {
                    return null
                  }
                  return (
                    <ListItem key={idx}>
                      <Tooltip title="Remove global plugin">
                        <IconButton
                          className={classes.mr}
                          onClick={() => handleRemove(idx)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <Typography>{label}</Typography>
                    </ListItem>
                  )
                })}
              </List>
            ) : (
              <Typography>No global plugins installed</Typography>
            )}
          </div>
        </Accordion>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Available plugins</Typography>
          </AccordionSummary>
          {fetchError ? (
            <Typography color="error" className={classes.m}>
              {`${fetchError}`}
            </Typography>
          ) : storePlugins ? (
            storePlugins
              .filter(p =>
                p.name.toLowerCase().includes(filterText.toLowerCase()),
              )
              .map(plugin => {
                const installed = isPluginInstalled(plugin, globalPlugins)
                return (
                  <Card
                    variant="outlined"
                    key={plugin.name}
                    className={classes.card}
                  >
                    <CardContent>
                      <Typography variant="h6">{plugin.name}</Typography>
                      <div className={classes.dataField}>
                        <PersonIcon className={classes.mr} />
                        <Typography>
                          {plugin.authors.join(', ')}
                        </Typography>
                      </div>
                      <Typography className={classes.bold}>
                        Description:
                      </Typography>
                      <Typography>{plugin.description}</Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        variant="contained"
                        disabled={installed}
                        startIcon={installed ? <CheckIcon /> : <AddIcon />}
                        onClick={() => handleInstall(plugin)}
                      >
                        {installed ? 'Installed' : 'Install'}
                      </Button>
                    </CardActions>
                  </Card>
                )
              })
          ) : (
            <LoadingEllipses />
          )}
        </Accordion>
      </DialogContent>
      {showCustomDialog ? (
        <AddCustomGlobalPluginDialog
          onClose={() => setShowCustomDialog(false)}
          onAdd={handleAddCustom}
        />
      ) : null}
    </Dialog>
  )
}
