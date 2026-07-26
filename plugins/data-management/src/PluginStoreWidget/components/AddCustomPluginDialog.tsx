import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { getEnv, getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Collapse, DialogContentText, TextField } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import { observer } from 'mobx-react'

import type { PluginStoreModel } from '../model.ts'

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

const AddCustomPluginDialog = observer(function AddCustomPluginDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: PluginStoreModel
}) {
  const { classes } = useStyles()
  const [umdPluginName, setUMDPluginName] = useState('')
  const [umdPluginUrl, setUMDPluginUrl] = useState('')
  const [esmPluginUrl, setESMPluginUrl] = useState('')
  const [cjsPluginUrl, setCJSPluginUrl] = useState('')
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)
  const session = getSession(model)
  const { jbrowse } = session
  const { pluginManager } = getEnv(model)
  const ready = Boolean(
    (umdPluginName && umdPluginUrl) || esmPluginUrl || cjsPluginUrl,
  )

  // Only the UMD form requires a name up front, so it is the only case that
  // can be checked before the plugin loads. ESM/CJS entries resolve their name
  // from the fetched module, so a same-name collision there only surfaces
  // later as PluginManager's silent skip-on-reload.
  function handleSubmit() {
    if (umdPluginName && umdPluginUrl) {
      if (pluginManager.hasPlugin(umdPluginName)) {
        session.notify(
          `A plugin named "${umdPluginName}" is already installed`,
          'error',
        )
        return false
      }
      jbrowse.addPlugin({ name: umdPluginName, umdUrl: umdPluginUrl })
    } else if (esmPluginUrl) {
      jbrowse.addPlugin({ esmUrl: esmPluginUrl })
    } else if (cjsPluginUrl) {
      jbrowse.addPlugin({ cjsUrl: cjsPluginUrl })
    }
    return true
  }

  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title="Add custom plugin"
      submitDisabled={!ready}
      onCancel={onClose}
      onSubmit={() => {
        if (handleSubmit()) {
          onClose()
        }
      }}
    >
      <div className={classes.dialogContent}>
        <DialogContentText>
          Enter the name of the plugin and its URL. The name should match what
          is defined in the plugin&apos;s build.
        </DialogContentText>
        <TextField
          label="Plugin name"
          variant="outlined"
          fullWidth
          margin="dense"
          value={umdPluginName}
          onChange={event => {
            setUMDPluginName(event.target.value)
          }}
        />
        <TextField
          label="Plugin URL"
          variant="outlined"
          fullWidth
          margin="dense"
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
              The above fields assume that the plugin is built in UMD format. If
              your plugin is in another format, or you have additional builds
              you want to add (such as a CJS build for using NodeJS APIs in
              desktop), you can enter the URLs for those builds below.
            </DialogContentText>
            <TextField
              label="ESM build URL"
              variant="outlined"
              fullWidth
              margin="dense"
              value={esmPluginUrl}
              onChange={event => {
                setESMPluginUrl(event.target.value)
              }}
            />
            <TextField
              label="CJS build URL"
              variant="outlined"
              fullWidth
              margin="dense"
              value={cjsPluginUrl}
              onChange={event => {
                setCJSPluginUrl(event.target.value)
              }}
            />
          </div>
        </Collapse>
      </div>
    </SubmitDialog>
  )
})

export default AddCustomPluginDialog
