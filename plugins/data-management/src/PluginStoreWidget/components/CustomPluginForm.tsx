import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import clsx from 'clsx'

import {
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  makeStyles,
} from '@material-ui/core'

// icons
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

import { PluginDefinition } from '@jbrowse/core/PluginLoader'

// locals
import { PluginStoreModel } from '../model'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
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

function CustomPluginForm({
  open,
  onClose,
  model,
}: {
  open: boolean
  onClose(): void
  model: PluginStoreModel
}) {
  const classes = useStyles()
  const [umdPluginName, setUMDPluginName] = useState('')
  const [umdPluginUrl, setUMDPluginUrl] = useState('')
  const [esmPluginUrl, setESMPluginUrl] = useState('')
  const [cjsPluginUrl, setCJSPluginUrl] = useState('')
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const { name, value } = event.target
    if (name === 'umdName') {
      setUMDPluginName(value)
    }
    if (name === 'umdUrl') {
      setUMDPluginUrl(value)
    }
    if (name === 'esmUrl') {
      setESMPluginUrl(value)
    }
    if (name === 'cjsUrl') {
      setCJSPluginUrl(value)
    }
  }

  function handleOpenAdvancedOptions() {
    setAdvancedOptionsOpen(!advancedOptionsOpen)
  }

  const rootModel = getRoot(model)
  const { jbrowse } = rootModel

  const ready = Boolean(
    (umdPluginName && umdPluginUrl) || esmPluginUrl || cjsPluginUrl,
  )

  function handleSubmit() {
    if (!ready) {
      return
    }
    const pluginDefinition: PluginDefinition = {}
    if (umdPluginName && umdPluginUrl) {
      pluginDefinition.name = umdPluginName
      pluginDefinition.umdUrl = umdPluginUrl
    }
    if (esmPluginUrl) {
      pluginDefinition.esmUrl = esmPluginUrl
    }
    if (cjsPluginUrl) {
      pluginDefinition.cjsUrl = cjsPluginUrl
    }
    jbrowse.addPlugin(pluginDefinition)
  }

  function handleClose() {
    setUMDPluginName('')
    setUMDPluginUrl('')
    setESMPluginUrl('')
    setCJSPluginUrl('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>
        Add custom plugin
        <IconButton
          size="medium"
          className={classes.closeButton}
          onClick={() => onClose()}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className={classes.dialogContent}>
          <DialogContentText>
            Enter the name of the plugin and its URL. The name should match what
            is defined in the plugin's build.
          </DialogContentText>
          <TextField
            id="umd-name-input"
            name="umdName"
            label="Plugin name"
            variant="outlined"
            value={umdPluginName}
            onChange={handleChange}
          />
          <TextField
            id="umd-url-input"
            name="umdUrl"
            label="Plugin URL"
            variant="outlined"
            value={umdPluginUrl}
            onChange={handleChange}
          />
          <DialogContentText onClick={handleOpenAdvancedOptions}>
            <IconButton
              className={clsx(classes.expand, {
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
                id="esm-url-input"
                name="esmUrl"
                label="ESM build URL"
                variant="outlined"
                value={esmPluginUrl}
                onChange={handleChange}
              />
              <TextField
                id="cjs-url-input"
                name="cjsUrl"
                label="CJS build URL"
                variant="outlined"
                value={cjsPluginUrl}
                onChange={handleChange}
              />
            </div>
          </Collapse>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleClose}>
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

export default observer(CustomPluginForm)
