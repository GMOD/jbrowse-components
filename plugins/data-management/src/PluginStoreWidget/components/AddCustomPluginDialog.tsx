import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

// icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Button,
  Collapse,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
} from '@mui/material'
import IconButton from '@mui/material/IconButton'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { PluginStoreModel } from '../model'

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

const AddCustomPluginDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: () => void
  model: PluginStoreModel
}) {
  const { classes, cx } = useStyles()
  const [umdPluginName, setUMDPluginName] = useState('')
  const [umdPluginUrl, setUMDPluginUrl] = useState('')
  const [esmPluginUrl, setESMPluginUrl] = useState('')
  const [cjsPluginUrl, setCJSPluginUrl] = useState('')
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)
  const { jbrowse } = getSession(model)
  const ready = Boolean(
    (umdPluginName && umdPluginUrl) || esmPluginUrl || cjsPluginUrl,
  )

  function handleSubmit() {
    if (umdPluginName && umdPluginUrl) {
      jbrowse.addPlugin({ name: umdPluginName, umdUrl: umdPluginUrl })
    } else if (esmPluginUrl) {
      jbrowse.addPlugin({ esmUrl: esmPluginUrl })
    } else if (cjsPluginUrl) {
      jbrowse.addPlugin({ cjsUrl: cjsPluginUrl })
    }
  }

  return (
    <Dialog open onClose={onClose} title="Add custom plugin">
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
            onChange={event => {
              setUMDPluginName(event.target.value)
            }}
          />
          <TextField
            label="Plugin URL"
            variant="outlined"
            value={umdPluginUrl}
            onChange={event => {
              setUMDPluginUrl(event.target.value)
            }}
          />
          <DialogContentText
            onClick={() => {
              setAdvancedOptionsOpen(!advancedOptionsOpen)
            }}
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
                onChange={event => {
                  setESMPluginUrl(event.target.value)
                }}
              />
              <TextField
                label="CJS build URL"
                variant="outlined"
                value={cjsPluginUrl}
                onChange={event => {
                  setCJSPluginUrl(event.target.value)
                }}
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
})

export default AddCustomPluginDialog
