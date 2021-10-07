import React, { useState } from 'react'
import { Button, Typography, makeStyles } from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import QuickstartPanel from './QuickstartPanel'
import OpenSequenceDialog from './dialogs/OpenSequenceDialog'

const useStyles = makeStyles(theme => ({
  form: {
    marginTop: theme.spacing(4),
    margin: theme.spacing(2),
    padding: theme.spacing(2),
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
      <Typography variant="h6">
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
          onClose={() => setSequenceDialogOpen(false)}
          setPluginManager={setPluginManager}
        />
      ) : null}
    </div>
  )
}
