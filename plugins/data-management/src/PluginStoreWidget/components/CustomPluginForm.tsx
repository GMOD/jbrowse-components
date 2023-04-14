import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  Collapse,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

// locals
import { PluginStoreModel } from '../model'

const useStyles = makeStyles()(theme => ({
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
  const { classes, cx } = useStyles()
  const [umdPluginName, setUMDPluginName] = useState('')
  const [umdPluginUrl, setUMDPluginUrl] = useState('')
  const [esmPluginUrl, setESMPluginUrl] = useState('')
  const [cjsPluginUrl, setCJSPluginUrl] = useState('')
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jbrowse } = getRoot<any>(model)

  const ready = Boolean(
    (umdPluginName && umdPluginUrl) || esmPluginUrl || cjsPluginUrl,
  )

  function handleSubmit() {
    if (umdPluginName && umdPluginUrl) {
      jbrowse.addPlugin({ name: umdPluginName, umdUrl: umdPluginUrl })
    }
    if (esmPluginUrl) {
      jbrowse.addPlugin({ esmUrl: esmPluginUrl })
    }
    if (cjsPluginUrl) {
      jbrowse.addPlugin({ cjsUrl: cjsPluginUrl })
    }
  }

  function handleClose() {
    setUMDPluginName('')
    setUMDPluginUrl('')
    setESMPluginUrl('')
    setCJSPluginUrl('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Add custom plugin">
      <form onSubmit={handleSubmit}>
        <DialogContent className={classes.dialogContent}>
          <DialogContentText>
            Enter the name of the plugin and its URL. The name should match what
            is defined in the plugin&apos;s build.
          </DialogContentText>
          <TextField
            id="umd-name-input"
            name="umdName"
            label="Plugin name"
            variant="outlined"
            value={umdPluginName}
            onChange={event => setUMDPluginName(event.target.value)}
          />
          <TextField
            id="umd-url-input"
            name="umdUrl"
            label="Plugin URL"
            variant="outlined"
            value={umdPluginUrl}
            onChange={event => setUMDPluginUrl(event.target.value)}
          />
          <DialogContentText
            onClick={() => setAdvancedOptionsOpen(!advancedOptionsOpen)}
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
                id="esm-url-input"
                name="esmUrl"
                label="ESM build URL"
                variant="outlined"
                value={esmPluginUrl}
                onChange={event => setESMPluginUrl(event.target.value)}
              />
              <TextField
                id="cjs-url-input"
                name="cjsUrl"
                label="CJS build URL"
                variant="outlined"
                value={cjsPluginUrl}
                onChange={event => setCJSPluginUrl(event.target.value)}
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
