import React, { useState } from 'react'
import { Button, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import QuickstartPanel from './QuickstartPanel'
import OpenSequenceDialog from '../OpenSequenceDialog'
import { loadPluginManager } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  form: {
    marginTop: theme.spacing(4),
  },
  button: {
    display: 'block',
    marginBottom: theme.spacing(3),
    width: 200,
    padding: theme.spacing(1),
  },
}))

export default function LauncherPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const { classes } = useStyles()
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
        onClick={() => {
          setSequenceDialogOpen(true)
        }}
      >
        Open sequence file(s)
      </Button>
      <Typography style={{ width: '50%', textAlign: 'center' }} variant="h6">
        -or-
      </Typography>
      <QuickstartPanel setPluginManager={setPluginManager} />

      {sequenceDialogOpen ? (
        <OpenSequenceDialog
          onClose={async (conf: unknown) => {
            if (conf) {
              // note this can throw before dialog closes, but this is handled
              // by the dialog itself
              const path = await ipcRenderer.invoke(
                'createInitialAutosaveFile',
                {
                  assemblies: conf,
                  defaultSession: {
                    name: `New Session ${new Date().toLocaleString('en-US')}`,
                  },
                },
              )
              setPluginManager(await loadPluginManager(path))
            }
            setSequenceDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
