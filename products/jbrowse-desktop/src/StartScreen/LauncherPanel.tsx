import React, { useState } from 'react'
import { Button, makeStyles } from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import PreloadedDatasetSelector from './PreloadedDatasetSelector'
import OpenSequenceDialog from './OpenSequenceDialog'

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
          onClose={() => setSequenceDialogOpen(false)}
          setPluginManager={setPluginManager}
        />
      ) : null}
    </div>
  )
}
