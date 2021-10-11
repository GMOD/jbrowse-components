import React, { useState } from 'react'
import { Button, makeStyles } from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import PreloadedDatasetSelector from './PreloadedDatasetSelector'
import OpenSequenceDialog from '../OpenSequenceDialog'
import { createPluginManager } from './util'

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
      <Button
        variant="contained"
        color="primary"
        className={classes.button}
        onClick={() => setSequenceDialogOpen(true)}
      >
        Open sequence file
      </Button>
      <PreloadedDatasetSelector setPluginManager={setPluginManager} />
      {sequenceDialogOpen ? (
        <OpenSequenceDialog
          onClose={async (conf: unknown) => {
            if (conf) {
              // note this can throw before dialog closes, but this is handled
              // by the dialog itself
              const pm = await createPluginManager({
                assemblies: [conf],
                defaultSession: {
                  name: 'New Session ' + new Date().toLocaleString('en-US'),
                },
              })
              setPluginManager(pm)
            }
            setSequenceDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
