import React, { useState } from 'react'
import { Button, Typography, makeStyles } from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import { ipcRenderer } from 'electron'
import QuickstartPanel from './QuickstartPanel'
import OpenSequenceDialog from '../OpenSequenceDialog'
import { loadPluginManager } from './util'
import { DesktopRootModel } from './types'

const useStyles = makeStyles(theme => ({
  form: {
    marginTop: theme.spacing(4),
  },
  button: {
    display: 'block',
    marginBottom: theme.spacing(3),
    width: 200,
    height: '3em',
  },
}))

export default function StartScreenOptionsPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const classes = useStyles()
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false)
  return (
    <div className={classes.form}>
      <Typography variant="h6" style={{ marginBottom: 5 }}>
        Select a sequence file e.g. FASTA file
      </Typography>
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => setSequenceDialogOpen(true)}
      >
        Open sequence file
      </Button>
      <div style={{ width: '50%' }}>
        <Typography style={{ textAlign: 'center' }} variant="h6">
          -or-
        </Typography>
      </div>
      <QuickstartPanel setPluginManager={setPluginManager} />

      {sequenceDialogOpen ? (
        <OpenSequenceDialog
          onClose={async (conf: unknown) => {
            if (conf) {
              // note this can throw before dialog closes, but this is handled
              // by the dialog itself
              const path = await ipcRenderer.invoke('createUnsavedFile', {
                assemblies: [conf],
                defaultSession: {
                  name: 'New Session ' + new Date().toLocaleString('en-US'),
                  saved: false,
                },
              })
              const pluginManager = await loadPluginManager(path)
              const { rootModel } = pluginManager
              if (rootModel) {
                ;(rootModel as DesktopRootModel).setUnsaved()
              }
              setPluginManager(pluginManager)
            }
            setSequenceDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
