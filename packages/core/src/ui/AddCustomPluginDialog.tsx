import { useState } from 'react'

import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Collapse,
  DialogContentText,
  IconButton,
  TextField,
} from '@mui/material'

import { cx, makeStyles } from '../util/tss-react/index.ts'
import SubmitDialog from './SubmitDialog.tsx'

import type { PluginDefinition } from '../pluginDefinitions.ts'

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

/**
 * The "add a plugin by url" form, shared by every place a plugin can be
 * installed from outside the store — the in-session plugin store widget and
 * Desktop's global plugins dialog — so both mint the same definition shapes
 * from the same fields.
 *
 * `onAdd` returns false to reject the definition and keep the dialog open (the
 * plugin store rejects a name already installed).
 */
export default function AddCustomPluginDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (definition: PluginDefinition) => boolean
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

  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title="Add custom plugin"
      submitDisabled={!ready}
      onCancel={onClose}
      onSubmit={() => {
        const definition =
          umdPluginName && umdPluginUrl
            ? { name: umdPluginName, umdUrl: umdPluginUrl }
            : esmPluginUrl
              ? { esmUrl: esmPluginUrl }
              : { cjsUrl: cjsPluginUrl }
        if (onAdd(definition)) {
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
}
